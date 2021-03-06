var g_cloud_map = {};
var g_selected_cloud = null;
var ENTER_KEYCODE = 13;


$(document).ready(function() {
    $("#nav-profile").addClass("active");
    $('a.nav-profile-menu').click(function (e) {
        e.preventDefault();
        window.location.hash = $(this).attr("href");
        $(this).tab('show');
    });

    $("#phantom_cloud_edit_add").click(function() {
        phantom_cloud_edit_add_click();
        return false;
    });

    $("#phantom_cloud_edit_remove").click(function() {
        phantom_cloud_edit_remove_click();
        return false;
    });

    $("#phantom_cloud_edit_name").change(function() {
        phantom_cloud_edit_change_cloud();
        return false;
    });

    $("#cloud_table_body").on('click', 'tr', function(event){
        $(this).parent().children().removeClass("info");
        var cloud_name = $(this).children().first().text();
        phantom_cloud_edit_change_cloud(cloud_name);
    });


    $("#change_password_button").click(function() {
        change_password_click();
        return false;
    });

    $(document).keypress(function(e) {
        if (e.which == ENTER_KEYCODE) {

            if ($("#account-settings").is(":visible")) {
                change_password_click();
            }
        }
    });

    if (window.location.hash === "#account-settings") {
        window.scrollTo(0, 0);
        $("#domain-nav a[href=#account-settings]").tab("show");
    }
    else { // Default
        window.scrollTo(0, 0);
        $("#domain-nav a[href=#cloud-credentials]").tab("show");
        $("#").addClass("active");
    }

    phantom_cloud_edit_load_page();
});

function phantom_cloud_edit_enable(enable) {
    if(enable) {
        $("#phantom_cloud_edit_add").removeAttr("disabled", "disabled");
        $("#phantom_cloud_edit_remove").removeAttr("disabled", "disabled");
        $('#phantom_cloud_edit_name').removeAttr("disabled", "disabled");

        if ($("#phantom_cloud_edit_keyname_list").children().length === 0) {
            $("#phantom_cloud_edit_keyname_list").parent().parent().hide();
        }
        else {
            $("#phantom_cloud_edit_keyname_list").parent().parent().show();
        }

        $('#loading').hide();
    }
    else {
        $("#phantom_cloud_edit_add").attr("disabled", "disabled");
        $("#phantom_cloud_edit_remove").attr("disabled", "disabled");
        $("#phantom_cloud_edit_name").attr("disabled", "disabled");
        $('#loading').show();
    }
}

function change_password_click() {
 
    $("#password-form .help-inline").remove();
    $("#password-form div").removeClass("error").removeClass("success");

    var old_password = $("#old_password").val();
    var new_password = $("#new_password").val();
    var new_password_confirm = $("#new_password_confirmation").val();

    var params = {
        "old_password": old_password,
        "new_password": new_password,
        "new_password_confirmation": new_password_confirm,
    };

    var success_func = function(obj) {
        $("#change_password_button")
            .after('<span class="help-inline"><i class="icon-ok"></i> Password Changed</span>')
            .removeAttr("disabled")
            .parent().parent().addClass("success");
    };

    var error_func = function(url, error_message) {
        $("#change_password_button").removeAttr("disabled");
        if (error_message === "BAD_OLD_PASSWORD") {
            $("#old_password").after('<span class="help-inline">Incorrect password</span>')
                .parent().parent().addClass("error");

        }
        else if (error_message === "PASSWORDS_DO_NOT_MATCH") {
            $("#new_password").parent().parent().addClass("error");
            $("#new_password_confirmation").after('<span class="help-inline">Passwords do not match</span>')
                .parent().parent().addClass("error");
        }
        else {
            alert("UNKNOWN ERROR: " + error_message);
        }
    };

    $("#change_password_button").attr("disabled", true);
    var url = '/accounts/ajax_change_password/';
    phantomAjaxPost(url, params, success_func, error_func);
}

function phantom_cloud_edit_add_click() {

    $("#cloud-credentials .help-inline").remove();
    $("#cloud-credentials div").removeClass("error");

    var nameCtl = $("#cloud_table_body tr.info td").first().text();
    //var nameCtl = $("#phantom_cloud_edit_name").val().trim();
    var accessCtl = $("#phantom_cloud_edit_access").val().trim();
    var secretCtl = $("#phantom_cloud_edit_secret").val().trim();
    var keyCtl = $("#phantom_cloud_edit_keyname_list").val();

    var error_msg = undefined;
    if(! nameCtl) {
        error_msg = "You must name your cloud."
    }
    if(! accessCtl) {
        $("#phantom_cloud_edit_access")
            .after('<span class="help-inline">You must set an access key</span>')
            .parent().parent().addClass("error");
        return;
    }
    if(! secretCtl) {
        $("#phantom_cloud_edit_secret")
            .after('<span class="help-inline">You must set a secret key</span>')
            .parent().parent().addClass("error");
        return;
    }
    if(keyCtl == undefined) {
        keyCtl = "";
    }

    if (error_msg) {
        phantom_alert(error_msg);
        return;
    }

    //send call to service
    var success_func = function (obj) {
        phantom_cloud_edit_load_sites();
    }

    var error_func = function(obj, message) {
        phantom_alert(message);
        phantom_cloud_edit_enable(true);
    }

    var url = make_url('api/sites/add');
    phantom_cloud_edit_enable(false);
    phantomAjaxPost(url, {'cloud': nameCtl, 'access': accessCtl, 'secret': secretCtl, 'keyname': keyCtl}, success_func, error_func);
}


function phantom_cloud_edit_change_cloud_internal(selected_cloud_name)  {

    if (!selected_cloud_name) {
        if (g_selected_cloud) {
            selected_cloud_name = g_selected_cloud;
        }
        else {
            selected_cloud_name = $("#cloud_table_body tr td").first().text();
        }
    }

    g_selected_cloud = selected_cloud_name;

    $(".control-group").removeClass("error");

    $("#cloud_table_body tr td:contains('" + selected_cloud_name + "')")
      .parent().addClass("info");

    var val = g_cloud_map[selected_cloud_name];

    $("#phantom_cloud_edit_key_message").text("");
    $("#phantom_cloud_edit_keyname_list").empty();
    if (val == undefined) {
        $("#phantom_cloud_edit_access").val("");
        $("#phantom_cloud_edit_secret").val("");
        $("#phantom_cloud_edit_keyname_list").parent().parent().hide();
    }
    else {
        $("#phantom_cloud_edit_keyname_list").parent().parent().show();
        $("#phantom_cloud_edit_access").val(val['access_key']);
        $("#phantom_cloud_edit_secret").val(val['secret_key']);
        if (val.status_msg) {
            phantom_alert(val.status_msg);
        }
        for (keyndx in val.keyname_list) {
            $("#phantom_cloud_edit_key_message").val("");
            key = val.keyname_list[keyndx]
            var new_choice = $('<option>',  {'name': key, value: key, text: key});
            $("#phantom_cloud_edit_keyname_list").append(new_choice);
        }
        if(val.keyname == undefined || val.keyname == "") {
            var msg = "Please set an ssh key and save.";
            $("#phantom_cloud_edit_keyname_list")
                .after('<span class="help-inline">' + msg + '</span>')
                .parent().parent().addClass("error");
        }
        else {
            $("#phantom_cloud_edit_keyname_list").val(val.keyname);
        }

    }
}

function show_cloud_edit_guides() {
        $("#phantom_cloud_edit_access")
            .after('<span class="help-inline">Password Changed</span>');
    
}

function phantom_cloud_edit_change_cloud (cloud_name) {
    try {
        phantom_cloud_edit_change_cloud_internal(cloud_name);
    }
    catch(err) {
        alert(err);
    }
}

function make_cloud_table_row(site, status) {

    if (status === "Enabled") {
        status = '<span class="label label-success">' + status + '</span>';
    }
    else if (status === "Incomplete") {
        status = '<span class="label label-warning">' + status + '</span>';
    }
    else if (status === "Disabled") {
        status = '<span class="label">' + status + '</span>';
    }
    else {
        status = '<span class="label">' + status + '</span>';
    }

    var row = "<tr id='cloud-row-" + site + "'>" +
      "<td class='cloud-data-site'>" + site + "</td>" +
      "<td>" + status + "</td>" +
      "</tr>";
    return row;
}

function phantom_cloud_edit_load_sites() {
    var url = make_url('api/sites/load');

    var success_func = function(obj){

        $("#cloud-credentials .help-inline").remove();
        $("#cloud_table_body").empty();
        var selected_cloud_name = $("#phantom_cloud_edit_name").val();

        g_cloud_map = obj.sites;

        for(var site_name in obj.all_sites) {
            site = obj.all_sites[site_name];

            var status = null;
            if (site in obj.sites) {
                if (!obj.sites[site]["keyname"]) {
                    status = "Incomplete";
                }
                else {
                    status = "Enabled";
                }
            }
            else {
                status = "Disabled";
            }
            $("#cloud_table_body").append(make_cloud_table_row(site, status));
        }
        phantom_cloud_edit_change_cloud_internal();
        phantom_cloud_edit_enable(true);
    };

    var error_func = function(obj, error_msg) {
        alert(error_msg);
        phantom_cloud_edit_enable(true);
    };

    phantom_cloud_edit_enable(false);
    ajaxCallREST(url, success_func, error_func);
}

function phantom_cloud_edit_load_page() {
    try {
        phantom_cloud_edit_enable(false);
        phantom_cloud_edit_load_sites();
    }
    catch(err) {
        alert(err);
    }
}

function phantom_cloud_edit_remove_click() {
    var cloud_name = $("#cloud_table_body tr.info td").first().text();
    var q = "Are you sure you want to remove the cloud ".concat(cloud_name).concat(" from your configuration?");
    var doit = confirm(q);

    if (!doit) {
        return;
    }

    var url = make_url("api/sites/delete");
    url = url.concat("?cloud=").concat(cloud_name);

    var success_func = function (obj) {
        $("#phantom_cloud_edit_name").empty();
        $("#phantom_cloud_edit_access").val("");
        $("#phantom_cloud_edit_secret").val("");
        $("#phantom_cloud_edit_keyname_list").empty();

        phantom_cloud_edit_load_sites();
    }

    var error_func = function(obj, message) {
        alert(error_msg);
        phantom_cloud_edit_enable(true);
    }

    phantom_cloud_edit_enable(false);
    ajaxCallREST(url, success_func, error_func);
}
