from boto.ec2.connection import EC2Connection
from boto.exception import BotoServerError
from django.template import Context, loader
from django.http import HttpResponse
import logging
import urlparse
from phantomweb.models import UserPhantomInfoDB
from phantomweb.phantom_web_exceptions import PhantomWebException
from phantomsql import PhantomSQL
from phantomweb.models import PhantomInfoDB, RabbitInfoDB
from ceiclient.client import DTRSClient, EPUMClient
from ceiclient.connection import DashiCeiConnection


g_general_log = logging.getLogger('phantomweb.general')


def LogEntryDecorator(func):
    def wrapped(*args, **kw):
        try:
            g_general_log.debug("Entering %s." % (func.func_name))
            return func(*args, **kw)
        except Exception, ex:
            g_general_log.exception("exiting %s with error: %s." % (func.func_name, str(ex)))
            raise
        finally:
            g_general_log.debug("Exiting %s." % (func.func_name))
    return wrapped

def PhantomWebDecorator(func):

    def wrapped(*args, **kw):
        try:
            response_dict = func(*args,**kw)
        except PhantomWebException, pex:
            g_general_log.exception("Phantom Error %s" % (pex.message))
            response_dict = {
                'error_message': pex.message,
            }
        except BotoServerError, bex:
            g_general_log.exception("Boto Error %s : %s" % (bex.reason, bex.body))
            response_dict = {
                'error_message': "Error communiting with the cloud service: %s" % (bex.reason),
            }
        g_general_log.debug("returning response_dict %s" % (str(response_dict)))
        return response_dict
    return wrapped


def render_template(fname, d):
    t = loader.get_template(full_path)
    c = Context(response_dict)
    return HttpResponse(t.render(c))

def get_cloud_objects(username):
    clouds = UserCloudInfoDB.objects.filter(username=username)
    return clouds

def get_user_object(username):
    phantom_l = UserPhantomInfoDB.objects.filter(username=username)
    if not phantom_l:
        return None
    if len(phantom_l) > 1:
        raise PhantomWebException("There are multiple users by the name %s.  The admin must clean this." % (username))
    return phantom_l[0]


class UserCloudInfo(object):

    def __init__(self, cloudname, username, iaas_key, iaas_secret, keyname, driver_class, site_desc=None):
        self.cloudname = cloudname
        self.username = username
        self.iaas_key = iaas_key
        self.iaas_secret = iaas_secret
        self.keyname = keyname
        self.driver_class = driver_class
        if site_desc:
            self.site_desc = site_desc.copy()

    def get_iaas_compute_con(self):
        site_url = "INVALID"
        if self.driver_class == "libcloud.compute.drivers.ec2.NimbusNodeDriver":
            return self._connect_nimbus()
        elif self.driver_class == "libcloud.compute.drivers.ec2.EC2NodeDriver":
            return self._connect_ec2()

        raise PhantomWebException("Unknown driver type")

    def _connect_nimbus(self):
        if 'driver_kwargs' not in self.site_desc:
            raise PhantomWebException("The site %s is misconfigured." % (self.cloudname))
        dets = self.site_desc['driver_kwargs']
        if dets['secure']:
            scheme = "https"
        else:
            scheme = "http"
        site_url = "%s://%s:%s" % (scheme, dets['host'], str(dets['port']))

        uparts = urlparse.urlparse(site_url)
        is_secure = uparts.scheme == 'https'
        ec2conn = EC2Connection(self.iaas_key, self.iaas_secret, host=uparts.hostname, port=uparts.port, is_secure=is_secure,  validate_certs=False)
        ec2conn.host = uparts.hostname
        return ec2conn

    def _connect_ec2(self):
        ec2conn = EC2Connection(self.iaas_key, self.iaas_secret)
        return ec2conn


class UserObject(object):
    pass

class UserObjectMySQL(UserObject):

    def __init__(self, username):

        self.username = username
        phantom_info_objects = PhantomInfoDB.objects.all()
        if not phantom_info_objects:
            raise PhantomWebException('The service is mis-configured.  Please contact your sysadmin')
        rabbit_info_objects = RabbitInfoDB.objects.all()
        if not rabbit_info_objects:
            raise PhantomWebException('The service is mis-configured.  Please contact your sysadmin')

        self.phantom_info = phantom_info_objects[0]
        self.rabbit_info = rabbit_info_objects[0]
        g_general_log.debug("Using dburl %s" % (self.phantom_info.dburl))
        self._authz = PhantomSQL(self.phantom_info.dburl)
        self._user_dbobject = self._authz.get_user_object_by_display_name(username)
        if not self._user_dbobject:
            raise PhantomWebException('The user %s is not associated with cloud user database.  Please contact your sysadmin' % (username))
        self.access_key = self._user_dbobject.access_key

        ssl = self.rabbit_info.rabbitssl
        self._dashi_conn = DashiCeiConnection(self.rabbit_info.rabbithost, self.rabbit_info.rabbituser, self.rabbit_info.rabbitpassword, exchange=self.rabbit_info.rabbitexchange, timeout=60, port=self.rabbit_info.rabbitport, ssl=ssl)
        self.epum = EPUMClient(self._dashi_conn)
        self.dtrs = DTRSClient(self._dashi_conn)

        self._load_clouds()


    def close(self):
        self._authz.close()

    def has_phantom_data(self):
        return True

    def describe_domain(self, username, domain):
        # TODO: this should eventually be part of the REST API
        describe = self.epum.describe_domain(domain, caller=username)
        g_general_log.info("describe_domain: %s" % describe)
        return describe

    def get_all_groups(self):
        domain_names = self.epum.list_domains(caller=self.access_key)
        domains = []
        for domain in domain_names:
            domain_description = self.epum.describe_domain(domain, caller=self.access_key)
            domains.append(domain_description)
        return domains

    def get_all_lcs(self):
        dt_names = self.dtrs.list_dts(self.access_key)
        dts = []
        for dt_name in dt_names:
            dt = self.dtrs.describe_dt(self.access_key, dt_name)
            dts.append(dt)
        return dts

    def load_clouds(self):
        self._load_clouds()

    def _load_clouds(self):
        dtrs_client = DTRSClient(self._dashi_conn)
        sites = dtrs_client.list_credentials(self._user_dbobject.access_key)
        self.iaasclouds = {}
        for site_name in sites:
            try:
                site_desc = dtrs_client.describe_site(site_name)
                desc = dtrs_client.describe_credentials(self._user_dbobject.access_key, site_name)
                uci = UserCloudInfo(site_name, self._user_dbobject.displayname, desc['access_key'], desc['secret_key'], desc['key_name'], site_desc['driver_class'], site_desc=site_desc)
                self.iaasclouds[site_name] = uci
            except Exception, ex:
                g_general_log.error("Failed trying to add the site %s to the user %s | %s" % (site_name, self._user_dbobject.displayname, str(ex)))

    def get_cloud(self, name):
        if name not in self.iaasclouds:
            raise PhantomWebException("No cloud named %s associated with the user" % (name))
        return self.iaasclouds[name]

    def get_clouds(self):
        return self.iaasclouds

    def get_possible_sites(self):
        site_client = DTRSClient(self._dashi_conn)
        l = site_client.list_sites()
        return l

    def add_site(self, site_name, access_key, secret_key, key_name):
        cred_client = DTRSClient(self._dashi_conn)
        site_credentials = {
            'access_key': access_key,
            'secret_key': secret_key,
            'key_name': key_name
        }
        if site_name in self.iaasclouds:
            cred_client.update_credentials(self._user_dbobject.access_key, site_name, site_credentials)
        else:
            cred_client.add_credentials(self._user_dbobject.access_key, site_name, site_credentials)
        self._load_clouds()

    def delete_site(self, site_name):
        cred_client = DTRSClient(self._dashi_conn)
        cred_client.remove_credentials(self._user_dbobject.access_key, site_name)
        self._load_clouds()


def get_user_object(username):
    return UserObjectMySQL(username)
