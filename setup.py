#!/usr/bin/env pythonv

from setuptools import setup, find_packages

import sys
Version = "0.2.1"
Name = "phantomweb"

if float("%d.%d" % sys.version_info[:2]) < 2.6:
    sys.stderr.write("Your Python version %d.%d.%d is not supported.\n" % sys.version_info[:3])
    sys.stderr.write("%s requires Python 2.6 or newer.\n" % (Name))
    sys.exit(1)

setup(name=Name,
      version=Version,
      description='A Django app for Nimbus Autoscale',
      author='Nimbus Development Team',
      author_email='workspace-user@globus.org',
      url='http://www.nimbusproject.org/',
      keywords = "Nimbus auto scale",
      long_description="""Some other time""",
      license="Apache2",
      packages=['phantomweb'],
      include_package_data=True,
      package_data={ 'phantomweb': ['templates/registration/*.html', 'templates/*.html', 'static/css/*', 'static/js/*', 'static/images/*']  },
      install_requires = ["django == 1.4", "boto == 2.6", "phantomsql == 0.2.1", "ceiclient"],
      dependency_links=[
          "http://github.com/nimbusproject/PhantomSQL/tarball/master#egg=phantomsql-0.2.1",
          "http://github.com/nimbusproject/ceiclient/tarball/master#egg=ceiclient-0.1"],
      classifiers=[
          'Development Status :: 4 - Beta',
          'Environment :: Console',
          'Intended Audience :: End Users/Desktop',
          'Intended Audience :: Developers',
          'Intended Audience :: System Administrators',
          'License :: OSI Approved :: Apache Software License',
          'Operating System :: MacOS :: MacOS X',
          'Operating System :: Microsoft :: Windows',
          'Operating System :: POSIX',
          'Operating System :: POSIX :: Linux',
          'Programming Language :: Python',
          'Topic :: System :: Clustering',
          'Topic :: System :: Distributed Computing',
          ],
     )
