/**
 * Created by tomk on 9/27/14.
 */

var PB_PIXEL_WIDTH_BAR = 6;
var PB_PIXEL_WIDTH_SPACING = 3;
var PB_PIXEL_HEIGHT = 100;

function saturate0(value) {
    if (value < 0) {
        return 0;
    }

    return value;
}

function PerfbarCore(coreIdx) {
    this.pbFirstUpdate = true;
    this.pbCoreIdx = coreIdx;
    this.pbUserTicks = 0;
    this.pbSystemTicks = 0;
    this.pbOtherTicks = 0;
    this.pbIdleTicks = 0;
    this.pbUserHeight = 0;
    this.pbSystemHeight = 0;
    this.pbOtherHeight = 0;
    this.pbX = this.pbCoreIdx * (PB_PIXEL_WIDTH_BAR + PB_PIXEL_WIDTH_SPACING);

    this.fill = function (ctx, fillStyle, x, y, x_width, y_height) {
        // console.log("fillRect:", fillStyle, x, y, x_width, y_height);
        ctx.fillStyle = fillStyle;
        ctx.fillRect(x, y, x_width, y_height);
    };

    this.initializeTicks = function (userTicks, systemTicks, otherTicks, idleTicks) {
        this.pbUserTicks = userTicks;
        this.pbSystemTicks = systemTicks;
        this.pbOtherTicks = otherTicks;
        this.pbIdleTicks = idleTicks;
    };

    this.updateTicks = function (ctx, userTicks, systemTicks, otherTicks, idleTicks) {
        // console.log("updateTics:", this.pbCoreIdx);

        var deltaUserTicks   = saturate0(userTicks - this.pbUserTicks);
        var deltaSystemTicks = saturate0(systemTicks - this.pbSystemTicks);
        var deltaOtherTicks  = saturate0(otherTicks - this.pbOtherTicks);
        var deltaIdleTicks   = saturate0(idleTicks - this.pbIdleTicks);
        var deltaTotalTicks  = deltaUserTicks + deltaSystemTicks + deltaOtherTicks + deltaIdleTicks;

        var userTicksPct;
        var systemTicksPct;
        var otherTicksPct;
        if (deltaTotalTicks > 0) {
            userTicksPct     = (deltaUserTicks / deltaTotalTicks);
            systemTicksPct   = (deltaSystemTicks / deltaTotalTicks);
            otherTicksPct    = (deltaOtherTicks / deltaTotalTicks);
        }
        else {
            userTicksPct     = 0;
            systemTicksPct   = 0;
            otherTicksPct    = 0;
        }

        var perfectUserHeight     = PB_PIXEL_HEIGHT * userTicksPct;
        var perfectSystemHeight   = PB_PIXEL_HEIGHT * systemTicksPct;
        var perfectOtherHeight    = PB_PIXEL_HEIGHT * otherTicksPct;

        // Blend previous and current height values to get some optical smoothing for the eye.
        // Take three parts old data and two parts new data.
        var blendedUserHeight;
        var blendedSystemHeight;
        var blendedOtherHeight;
        if (this.pbFirstUpdate) {
            // Don't blend, since there is nothing to smooth out.
            blendedUserHeight     = perfectUserHeight;
            blendedSystemHeight   = perfectSystemHeight;
            blendedOtherHeight    = perfectOtherHeight;
        }
        else {
            blendedUserHeight     = (3*this.pbUserHeight   + 2*perfectUserHeight)   / 5;
            blendedSystemHeight   = (3*this.pbSystemHeight + 2*perfectSystemHeight) / 5;
            blendedOtherHeight    = (3*this.pbOtherHeight  + 2*perfectOtherHeight)  / 5;
        }
        var blendedIdleHeight     = saturate0(PB_PIXEL_HEIGHT - (blendedUserHeight + blendedSystemHeight + blendedOtherHeight));

        var x = this.pbX;
        var x_width = PB_PIXEL_WIDTH_BAR;
        var y;
        var y_height;

        // user (green)
        y = blendedIdleHeight + blendedOtherHeight + blendedSystemHeight;
        y_height = blendedUserHeight;
        this.fill(ctx, "#00FF00", x, y, x_width, y_height);

        // system (red)
        y = blendedIdleHeight + blendedOtherHeight;
        y_height = blendedSystemHeight;
        this.fill(ctx, "#FF0000", x, y, x_width, y_height);

        // other (white)
        y = blendedIdleHeight;
        y_height = blendedOtherHeight;
        this.fill(ctx, "#FFFFFF", x, y, x_width, y_height);

        // idle (blue)
        y = 0;
        y_height = blendedIdleHeight;
        this.fill(ctx, "#0000FF", x, y, x_width, y_height);

        this.pbUserTicks = userTicks;
        this.pbSystemTicks = systemTicks;
        this.pbOtherTicks = otherTicks;
        this.pbIdleTicks = idleTicks;

        this.pbUserHeight = blendedUserHeight;
        this.pbSystemHeight = blendedSystemHeight;
        this.pbOtherHeight = blendedOtherHeight;

        this.pbFirstUpdate = false;
    };
}

function Perfbar(nodeName, nodeIdx, numCores) {
    this.pbCtx = null;
    this.pbNodeName = nodeName;
    this.pbNodeIdx = nodeIdx;
    this.pbNumCores = numCores;
    this.pbCores = new Array(numCores);

    console.log("instantiating:", this.pbNodeName, this.pbNodeIdx);

    for (var i = 0; i < numCores; i++) {
        this.pbCores[i] = new PerfbarCore (i);
    }

    this.docWriteCanvas = function() {
        var width = (numCores * PB_PIXEL_WIDTH_BAR) + ((numCores - 1) * PB_PIXEL_WIDTH_SPACING);

        var s = "<canvas id=\"" +
            nodeName + "" +
            "\" width=\"" +
            width +
            "\" height=\"" +
            PB_PIXEL_HEIGHT +
            "\" style=\"background-color: black;\"></canvas>\n";
            console.log("docWriteCanvas: ", s);
        document.write(s);
    };

    this.docGetElement = function() {
        // console.log("docGetElement called");
        var c = document.getElementById(this.pbNodeName);
        this.pbCtx = c.getContext("2d");
    };

    this.initializeTicks = function(cpuTicks) {
        if (cpuTicks.length != this.pbNumCores) {
            // This is really bad.
            console.log("ERROR: ", cpuTicks.length, "!=", this.pbNumCores);
        }

        for (var i = 0; i < this.pbNumCores; i++) {
            this.pbCores[i].initializeTicks(cpuTicks[i][0], cpuTicks[i][1], cpuTicks[i][2], cpuTicks[i][3]);
        }
    };

    this.updateTicks = function(cpuTicks) {
        if (cpuTicks.length != this.pbNumCores) {
            // This is really bad.
            console.log("ERROR: ", cpuTicks.length, "!=", this.pbNumCores);
        }

        for (var i = 0; i < this.pbNumCores; i++) {
            this.pbCores[i].updateTicks(this.pbCtx, cpuTicks[i][0], cpuTicks[i][1], cpuTicks[i][2], cpuTicks[i][3]);
        }
    };
}

var perfbars = null;
var timeouts = null;
var timeoutDelayMillis = 200;
var cloud_size = -1;
var acknowledged_cloud_size = 0;

initializeCloud();
repaintAndArmTimeout();

function initializeCloud() {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState==4 && xmlhttp.status==200) {
            console.log(xmlhttp.responseText);
            var obj = JSON.parse(xmlhttp.responseText);
            cloud_size = obj.cloud_size;
            console.log("cloud size is " + cloud_size);
            cloud_size = 1;
            console.log("HACK forcing cloud size to 1");
            perfbars = new Array(cloud_size);
            for (var i = 0; i < cloud_size; i = i + 1) {
                initializeNode(i);
            }
            timeouts = new Array(cloud_size);
        }
    };
    xmlhttp.open("GET","/2/Cloud.json",true);
    xmlhttp.send();
}

function initializeNode(nodeIdx) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.pbNodeIdx = nodeIdx;
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState==4 && xmlhttp.status==200) {
            var nodeIdx = xmlhttp.pbNodeIdx;
            var nodeName = "node " + nodeIdx;

            console.log("initializeNode ", nodeIdx, "response: ", xmlhttp.responseText);
            var obj = JSON.parse(xmlhttp.responseText);
            var cpuTicks = obj.cpuTicks;
            if (cpuTicks.length == 0) {
                console.log("ticks array has length " + cpuTicks.length);
                return;
            }

            var numCpus = cpuTicks.length;
            var pb = new Perfbar(nodeName, nodeIdx, numCpus);
            perfbars[nodeIdx] = pb;
            pb.initializeTicks(cpuTicks);

            // Only emit the doc elements once all nodes have checked in.
            // This way they are laid out synchronously and in order.
            acknowledged_cloud_size = acknowledged_cloud_size + 1;
            if (acknowledged_cloud_size == cloud_size) {
                for (var i = 0; i < cloud_size; i++) {
                    var pb2 = perfbars[i];
                    pb2.docWriteCanvas();
                    pb2.docGetElement();

                    // TODO: nonstandard parameter passed to timeout function.
                    timeouts[i] = setTimeout(function(idx) {
                        repaintAndArmTimeout(idx);
                    }, timeoutDelayMillis, i);
                }
            }
        }
    };
    xmlhttp.open("GET","/2/WaterMeterCpuTicks.json",true);
    xmlhttp.send();
}

function repaintAndArmTimeout(nodeIdx) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.pbNodeIdx = nodeIdx;
    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
            var nodeIdx = xmlhttp.pbNodeIdx;
            console.log("repaintAndArmTimeout", nodeIdx, "response: ", xmlhttp.responseText);
            var obj = JSON.parse(xmlhttp.responseText);
            var cpuTicks = obj.cpuTicks;
            perfbars[nodeIdx].updateTicks(cpuTicks);

            // TODO: nonstandard parameter passed to timeout function.
            timeouts[nodeIdx] = setTimeout(function(idx) {
                repaintAndArmTimeout(idx);
            }, timeoutDelayMillis, nodeIdx);
        }
    };
    xmlhttp.open("GET", "/2/WaterMeterCpuTicks.json", true);
    xmlhttp.send();
}