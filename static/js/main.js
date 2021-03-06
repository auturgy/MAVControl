let map, icon, flightPath;
let locationHistory = [];
let maxPathHistory = 300;
let attitude = {roll: 0, pitch: 0, yaw: 0};
let cs = {location: 0, lat: 0, lng: 0, heading: 0, airspeed: 0, altitude_agl: 0, attitude: attitude, ap_type: null};

let delay = 10; //milliseconds
let i = 0;
let auto_scroll_messages = true;

// ================== Socket IO init stuff ==================
let namespace = '/MAVControl';
let socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port + namespace);


// ====== Vehicle UI Stuff ======
function updateMapLocation() {
    locationHistory.unshift([cs.lat, cs.lng]);

    if (locationHistory.length > maxPathHistory) {
        locationHistory.pop();
    }

    // Set our rotation
    planeMarker.setRotationAngle(cs.heading);

    // Set our location
    planeMarker.setLatLng(cs.location);
    leafletmap.setView(cs.location);

    // Update flight path
    flightPath.setLatLngs(locationHistory);

}

$(document).ready(function () {
    // ====== Page Stuff ======
    $('.modal').modal();
    $('select').material_select();

    // ====== Handle Socket IO Messages ======
    socket.on('airspeed', function (message) {
        cs.airspeed = parseFloat(message).toFixed(2);
        document.getElementById('floating-scale-pointer-speed').innerText = String(Math.round(cs.airspeed)) + " m/s";
    });

    socket.on('altitude_agl', function (message) {
        cs.altitude_agl = parseFloat(message).toFixed(2);
        document.getElementById('floating-scale-pointer-altitude').innerText = String(Math.round(cs.altitude_agl)) + " m";
    });

    socket.on('mode', function (message) {
        cs.mode = message;
        document.getElementById('status_mode').innerText = cs.mode;
        document.getElementById('floating-mode-text').innerText = cs.mode;
    });

    socket.on('armed', function (message) {
        Materialize.toast('ARMED!!', 2000);
    });

    socket.on('disarmed', function (message) {
        Materialize.toast('DISARMED!!', 2000);
    });

    socket.on('ap_type', function (message) {
        cs.ap_type = message;
    });

    socket.on('attitude', function (message) {
        cs.attitude.pitch = message.pitch;
        cs.attitude.roll = message.roll;
        cs.attitude.yaw = message.yaw;
        let hud_roll = -message.roll;
        //let hud_roll = 0;
        let pitch_movement = (message.pitch*0.88)-26;

        let div = document.getElementById('moving-hud-panel');
        let div2 = document.getElementById('moving-hud-markings');

        div.style.webkitTransform = 'rotate(' + hud_roll + 'deg)';
        div.style.mozTransform = 'rotate(' + hud_roll + 'deg)';
        div.style.msTransform = 'rotate(' + hud_roll + 'deg)';
        div.style.oTransform = 'rotate(' + hud_roll + 'deg)';
        div.style.transform = 'rotate(' + hud_roll + 'deg)';
        div2.style.transform = 'translateX(-57%) translateY(' + pitch_movement + '%)';
    });

    socket.on('location', function (coord) {
        cs.heading = coord.heading;
        cs.lat = coord.lat;
        cs.lng = coord.lng;
        cs.location = [coord.lat, coord.lng];
        updateMapLocation();
    });

    // ====== Handle Messages ======
    socket.on('status_text', function (message) {
        $('#messages').append($('<div/>').text(new Date().toLocaleTimeString() + " - " + message.text).html() + '<br>');
        if (auto_scroll_messages) {
            document.getElementById('messages').scrollTop = document.getElementById('messages').offsetHeight;
        }
    });

    document.getElementsByName("auto_scroll_toggle")[0].addEventListener('change', function () {
        let is_checked = document.getElementsByName('auto_scroll_toggle')[0].checked;
        if (is_checked) {
            auto_scroll_messages = true;
            document.getElementById('messages').scrollTop = 9999999;
        } else {
            auto_scroll_messages = false;
        }
    });

    document.getElementById("clear_message_btn").addEventListener('click', function () {
        document.getElementById('messages').innerHTML = "";
        Materialize.toast('Messages cleared', 2000);
    });

    // ================== Mavlink Stuff ==================
    socket.on('heartbeat', function (message) {
        document.getElementById("footer-heartbeat").innerText = message;
    });

    // Event handler for new socket io connections.
    socket.on('connect', function () {
        console.log('Connected to backend');
        Materialize.toast('Backend connected', 2000);
        socket.emit('my_event', {data: 'I\'m connected!'});
    });

    // Interval function that tests message latency by sending a "ping"
    // message. The server then responds with a "pong" message and the
    // round trip time is measured.
    let ping_pong_times = [];
    let start_time;
    window.setInterval(function () {
        start_time = (new Date).getTime();
        socket.emit('my_ping');
    }, 1000);

    // Handler for the "pong" message. When the pong is received, the
    // time from the ping is stored, and the average of the last 30
    // samples is average and displayed.
    socket.on('my_pong', function () {
        let latency = (new Date).getTime() - start_time;
        ping_pong_times.push(latency);
        ping_pong_times = ping_pong_times.slice(-5); // keep last 30 samples
        let sum = 0;
        for (let i = 0; i < ping_pong_times.length; i++)
            sum += ping_pong_times[i];
        $('#footer-ping-pong').text(Math.round(10 * sum / ping_pong_times.length) / 10);
        $('#about-ping-pong').text(Math.round(10 * sum / ping_pong_times.length) / 10);
    });

    // When we get a successful message, pop the toast
    socket.on("conn_update_success", function () {
        Materialize.toast('Successfully updated connection settings.', 4000);
    });

    // Update connection settings emit/receive
    document.getElementById("update_connection_settings").addEventListener("click", function () {
        // Check the values are correct - we're relying on HTML5 validation rules here
        let ip_valid = document.getElementById("update_connection_settings_ip").checkValidity();
        let port_valid = document.getElementById("update_connection_settings_port").checkValidity();

        if (ip_valid && port_valid) {
            // Pull out the values from the form
            let ip = document.getElementById("update_connection_settings_ip").value;
            let port = document.getElementById("update_connection_settings_port").value;
            // Send it to the backend
            socket.emit('update_connection_settings', ip, port);
            $('#modal_conn_settings').modal('close');
        } else {
            Materialize.toast('Unable to save, please check the IP/Port.', 4000) // 4000 is the duration of the toast
        }
    });

    $('form#emit').submit(function () {
        socket.emit('my_event', {data: $('#emit_data').val()});
        return false;
    });

    $('form#disconnect').submit(function () {
        socket.emit('disconnect_request');
        return false;
    });


    // Update the status tab twice per second
    function updateStatusTab() {
        document.getElementById('status_airspeed').innerText = String(cs.airspeed);
        document.getElementById('status_altitude').innerText = String(cs.altitude_agl);
        document.getElementById('status_latitude').innerText = String(cs.lat);
        document.getElementById('status_longitude').innerText = String(cs.lng);
        document.getElementById('status_heading').innerText = String(cs.heading);
        document.getElementById('status_pitch').innerText = String(cs.attitude.pitch);
        document.getElementById('status_roll').innerText = String(cs.attitude.roll);
        document.getElementById('status_yaw').innerText = String(cs.attitude.yaw);
        document.getElementById('status_ap_type').innerText = String(cs.ap_type);
        setTimeout(updateStatusTab, 500);
    }

    updateStatusTab();
});