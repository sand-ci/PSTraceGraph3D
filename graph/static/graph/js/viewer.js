
let shapes = {
    "large_sphere": new THREE.SphereGeometry(8, 32, 32),
    // "torus": new THREE.TorusGeometry(8, 2, 16, 25),
    // "large_sphere": new THREE.TorusKnotGeometry(6, 1),
    "sphere": new THREE.SphereGeometry(5, 32, 32)
};

// let materialsOpacity = {
//     "large_sphere": 0.75,
//     "sphere": 0.5
// };

const Graph = ForceGraph3D()(document.getElementById('graph-container'))
    .backgroundColor("#ffffff")
    .width($(window).width())
    .height($(window).height())
    .linkCurvature('curvature') // High consuming
    .linkCurveRotation('rotation') // High consuming
    .nodeLabel('label')
    .nodeColor("color")
    .linkColor("color")
    .linkDirectionalArrowLength(4)
    .linkDirectionalArrowRelPos(1)
    .linkVisibility(link => link['folded'] !== false)
    .linkLabel("distance_mask")
    .showNavInfo(false)
    .nodeThreeObject(({ shape, color }) => new THREE.Mesh(
        shapes[shape],
        new THREE.MeshBasicMaterial({
            color: color
        })
    ))
    .onLinkClick(link => {
        let pathID = link["path_id"];
        if (pathsAreFolded) {
            pathID += "/1"
        }
        let table = $("#paths-table").DataTable();
        table.rows().every( function () {
            let rowPathID = this.data()[9];
            if (rowPathID === pathID) {
                $(this.node()).click();
            }
        });
    });

const linkForce = Graph
    .d3Force('link')
    .distance(link => (link["avg_distance"] > 0) ? link["avg_distance"] : (link["distance"] > 0) ? link["distance"] : 0.001);


function LeftToRight() {
    let maxX = 0;
    let minX = 0;

    Graph.graphData().nodes.forEach(node => {
        if (node.x > maxX) {
            maxX = node.x;
        }

        if (node.fx > maxX) {
            maxX = node.fx
        }

        if (node.x < minX) {
            minX = node.x
        }

        if (node.fx < minX) {
            minX = node.fx
        }
    });

    Graph.graphData().nodes.forEach(node => {
        if (node.pos === "beginning") {
            node.fx = minX - 50;
        }

        if (node.pos === "ending") {
            node.fx = maxX + 50;
        }
    });

    Graph.refresh()
}

function updateLinkDistance() {
    let power =  $("#distance-power").val();
    linkForce.distance(link => (link["avg_distance"] > 0) ? link["avg_distance"] * power : (link["distance"] > 0) ? link["distance"] * power : 0.001);
}

let graphData = null;

let pathHighlighted = [];
let pathClicked = null;

let currentQuery = {
    "query": null,
    "current_jump_index": 0,
    "jumps": [],
    "max_nodes": null,
    "number_of_dimensions": 3,
    "ipv6": null
};

let buckets = {
    "src": [],
    "src_site": [],
    "src_host": [],
    "dest": [],
    "dest_site": [],
    "dest_host": []
};

let filters = [
        ['src', 'Src'],
        ['src_site', 'Src site'],
        ['src_host', 'Src host'],
        ['dest', 'Dest'],
        ['dest_site', 'Dest site'],
        ['dest_host', 'Dest host'],
    ];

let pathsAreFolded = true;

let ctx = document.getElementById('path-chart').getContext('2d');
let pathChart = new Chart(ctx, {
    type: 'bar',
    data: {},
    options: {
        legend: {
            display: false,
        },
        title: {
            display: true,
            text: "Distances",
            fontSize: 14
        },
        tooltips: {
            callbacks: {
                label: function(tooltipItem, data) {
                    let label = data.datasets[tooltipItem.datasetIndex].label || '';
                    let pathID = label.slice(6, label.length -1);
                    let fragment = tooltipItem.index + 1;

                    Graph.linkColor(link => (link['path_id'] === pathID) ? (link["path_fragment"] === fragment) ? "#00bfb3": link["color"]: link["color"]);

                    let table = $("#path-distance-table");
                    let rows = table.find("tr");

                    for (let i = 0; i < rows.length; i++) {
                        if (i === tooltipItem.index + 1) {
                            rows.eq(i).addClass("selected");
                        } else {
                            rows.eq(i).removeClass("selected")
                        }
                    }

                    if (label) {
                        label += ': ';
                    }
                    label += Math.round(tooltipItem.yLabel * 100) / 100;
                    return label;
                }
            }
        }
    },
});

function GenerateQuery() {
    let query = {
        "bool": {
            "must": []
        }
    };

    let fromDatetime = $('#from-datetime').data("DateTimePicker").date();
    let toDatetime = $('#to-datetime').data("DateTimePicker").date();

    if (fromDatetime && toDatetime) {
        query["bool"]["must"].push({
            "range": {
                "timestamp": {
                    "gte": fromDatetime.format('x'),
                    "lte": toDatetime.format('x')
                }
            }
        })
    }

    for (let i = 0; i < filters.length; i++) {
        if (buckets[filters[i][0]].length > 0) {
            let terms = {};
            terms[filters[i][0]] = buckets[filters[i][0]];
            for (let t = 0; t < terms[filters[i][0]].length; t++) {

                let matchPhrase = {};
                matchPhrase[filters[i][0]] = terms[filters[i][0]][t];

                query["bool"]["must"].push({
                    "match_phrase": matchPhrase
                })
            }
        }
    }

    if (currentQuery.ipv6 !== null && currentQuery.ipv6 !== "null") {
        query["bool"]["must"].push({
            "term": {
                "ipv6": currentQuery.ipv6
            }
        })
    }

    return query
}

function UpdateUrl() {
    let data = {
        "query": JSON.stringify(currentQuery.query),
        "current_jump_index": currentQuery.current_jump_index,
        "jumps": currentQuery.jumps.join(","),
        "max_nodes": currentQuery.max_nodes,
        "number_of_dimensions": currentQuery.number_of_dimensions,
        "ipv6": currentQuery.ipv6
    };

    let urlParams = [];

    Object.entries(data).forEach(entry => {
      let key = entry[0];
      let value = entry[1];

      urlParams.push(encodeURIComponent(key) + '=' + encodeURIComponent(value))

    });

    window.history.pushState(data, 'queried', window.location.origin + "/graph/viewer?" + urlParams.join("&"));
}

function DispatchUrlQuery() {
    let url = new URL(window.location.href);
    let rawQuery = url.searchParams.get("query");

    currentQuery.number_of_dimensions = url.searchParams.get("number_of_dimensions");

    if (currentQuery.number_of_dimensions && currentQuery.number_of_dimensions !== "null") {
        let dimensionInputs = $("#dimensions-switcher-container input");
        for (let i = 0; i < dimensionInputs.length; i++) {
            if (dimensionInputs.eq(i).data("dimension") === Number(currentQuery.number_of_dimensions)) {
                dimensionInputs.eq(i).prop("checked");
                dimensionInputs.eq(i).closest("label").addClass("active")
            } else {
                dimensionInputs.eq(i).closest("label").removeClass("active")
            }
        }
    }

    if (rawQuery) {
        rawQuery = JSON.parse(rawQuery);

        let paramsList = rawQuery["bool"]["must"];
        for (let i = 0; i < paramsList.length; i ++) {

            if (Object.keys(paramsList[i]).indexOf("range") > -1) {
                let fromDate = paramsList[i]["range"]["timestamp"]["gte"];
                let toDate = paramsList[i]["range"]["timestamp"]["lte"];

                $('#from-datetime').data("DateTimePicker").date(new Date(Number(fromDate)));
                $('#to-datetime').data("DateTimePicker").date(new Date(Number(toDate)));
            }

            if (Object.keys(paramsList[i]).indexOf("match_phrase") > -1) {

                Object.entries(paramsList[i]["match_phrase"]).forEach(entry => {
                    let key = entry[0];
                    let value = entry[1];

                    let bucket = $("#" + key + "-bucket").find(".bucket-wrapper");
                    if (buckets[key].indexOf(value) < 0) {
                        bucket.append('<div class="bucket-item" onclick="RemoveFromBucket(this)">' + value + '</div>');
                        buckets[key].push(value);

                        let indicator = bucket.closest(".query-item").find(".filter-indicator");
                        indicator.text(bucket.find('.bucket-item').length);
                    }
                });
            }
        }
    }

    currentQuery.ipv6 = url.searchParams.get("ipv6");
    if (currentQuery.ipv6 === null) {
        currentQuery.ipv6 = "null"
    }
    if (currentQuery.ipv6 !== "null") {
        let ipvInputs = $("#ipv-form input");
        for (let i = 0; i < ipvInputs.length; i++) {
            if (String(ipvInputs.eq(i).data("ipv6")) === currentQuery.ipv6) {
                ipvInputs.eq(i).prop("checked");
                ipvInputs.eq(i).closest("label").addClass("active")
            } else {
                ipvInputs.eq(i).closest("label").removeClass("active")
            }
        }
    }
}

function SwitchDimensions(element) {
    let numberDimension = $(element).data("dimension");
    currentQuery.number_of_dimensions = numberDimension;

    Graph.numDimensions(numberDimension);

    UpdateUrl()
}

function SwitchIPv(element) {
    currentQuery.ipv6 = $(element).data("ipv6");
    SwitchApplyPulse();
    UpdateUrl()
}

function DoQuery(jumpTo) {
    if (jumpTo) {
        BuildGraph(jumpTo)
    } else {
        currentQuery['query'] = GenerateQuery();
        currentQuery['current_jump_index'] = 0;
        currentQuery['jumps'] = [];
        currentQuery['max_nodes'] = null;

        BuildGraph()
    }
}

function RefreshGraph() {
    BuildGraph("stay")
}

function BuildGraph(jumpTo) {
    $.ajax({
        url: window.location.origin + "/graph/ajax/builder",
        data: {
            "query": JSON.stringify(currentQuery.query),
            "current_jump_index": currentQuery.current_jump_index,
            "jumps": currentQuery.jumps.join(","),
            "jump_to": jumpTo,
            "max_nodes": currentQuery.max_nodes,
            "ipv6": currentQuery.ipv6
        },
        dataType: "json",
        method: 'GET',
        type: 'GET',
        success: function (data) {
            if (data["status"]) {
                graphData = data["graph_data"];
                currentQuery.current_jump_index = data["current_jump_index"];
                currentQuery.jumps = data["jumps"];
                currentQuery.max_nodes = data["max_nodes"];
                $("#max_nodes").val(data["max_nodes"]);

                UpdateGraphData();
                UpdateToolbar(data['is_previous'], data['is_next']);
                UpdateFilters(data['aggregations']);
                UpdatePathsTable(data['table_data']);
                UpdateTimeFilter(data['from_datetime'], data['to_datetime']);

                let fromDatetime = $('#from-datetime');
                let toDatetime = $('#to-datetime');

                if (!fromDatetime.data("DateTimePicker").date() && !toDatetime.data("DateTimePicker").date()) {
                    fromDatetime.data("DateTimePicker").date(data["from_datetime"]);
                    toDatetime.data("DateTimePicker").date(data["to_datetime"]);

                    currentQuery.query = GenerateQuery()
                }

                SwitchApplyPulse();
                UpdateUrl();
            } else {
                alert(data["message"])
            }
        },
        error: function () {
            alert("Request failed. Please check the connection.")
        }
    })
}

function FoldUpPaths() {
    let table = $("#paths-table").DataTable();
    let pathClickedBuffer = pathClicked;

    table.rows().every( function () {
        $(this.node()).removeClass("selected");
        let rowPathID = this.data()[9];
        if (rowPathID === pathClickedBuffer) {
            $(this.node()).click();
            $(this.node()).addClass("selected");
        }
    });

    let rangeSlider = $("#time-filter").data("ionRangeSlider");

    if (pathsAreFolded) {
        Graph.linkVisibility(link => link['folded'] !== true);
        rangeSlider.update({
            disable: false
        });
        pathsAreFolded = false;
    } else {
        Graph.linkVisibility(link => link['folded'] !== false);
        rangeSlider.update({
            disable: true
        });
        pathsAreFolded = true;
    }

    table.rows().every( function () {
        let rowPathID = this.data()[9];
        if (rowPathID === pathClickedBuffer) {
            // TODO eliminate "every" loop
            $(this.node()).click();
        }
    });
}

function UpdateGraphData() {
    Graph.nodeColor("color").linkColor("color").graphData(graphData);
    if (pathsAreFolded) {
        Graph.linkVisibility(link => link['folded'] !== false)

    } else {
        Graph.linkVisibility(link => link['folded'] !== true)
    }

    Graph.linkDirectionalParticleWidth(0).linkDirectionalParticles(0).linkDirectionalParticleSpeed(0);

    updateLinkDistance();
    Graph.numDimensions(currentQuery.number_of_dimensions);
}

function UpdateToolbar(isPrevious, isNext) {
    let previousBtn = $("#jump-to-previous");
    let nextBtn = $("#jump-to-next");

    if (isPrevious) {
        previousBtn.removeClass("disabled");
        previousBtn.addClass("enabled");
    } else {
        previousBtn.removeClass("enabled");
        previousBtn.addClass("disabled");
    }

    if (isNext) {
        nextBtn.removeClass("disabled");
        nextBtn.addClass("enabled");
    } else {
        nextBtn.removeClass("enabled");
        nextBtn.addClass("disabled");
    }
}

function UpdateFilters(aggregations) {
    let filterBucket = null;

    for (let i =0; i < filters.length; i++) {
        filterBucket = $("#" + filters[i][0] + "-bucket-table");
        filterBucket.DataTable().destroy();
        filterBucket.DataTable({
            bLengthChange: false,
            scrollY: 225,
            data: aggregations[filters[i][0]],
            pagingType: "simple",
            columns: [{title: filters[i][1]}, {title: "Count"}],
            columnDefs:[
                {targets:[0], className:"long-td"},
                {targets:[1], className:"short-td"}
            ],
            createdRow: function(row){
                $(row).on("click", function () {
                    AddToBucket(row, filters[i][0])
                });
            },
        });
    }
}

function UpdatePathsTable(tableData) {
    let pathsTable = $("#paths-table");
    pathsTable.DataTable().destroy();
    pathsTable.DataTable({
        bLengthChange: false,
        scrollY: 225,
        data: tableData,
        pagingType: "simple",
        columns: [
            {title: "Source"},
            {title: "Source site"},
            {title: "Source host"},
            {title: "IPv6"},
            {title: "Timestamp"},
            {title: "Destination"},
            {title: "Destination site"},
            {title: "Destination host"},
            {title: "Incomplete"},
            {title: "Path ID"}
        ],
        columnDefs:[
            {targets:[3], className:"text-center-td"},
            {targets:[4], className:"no-text-wrap"},
            {targets:[0, 1, 2, 4, 5, 6, 7], className:"long-td"},
            {targets:[8], className:"text-center-td"},
            {targets: [9], visible: false}
        ],
        createdRow: function(row){
            $(row).on("click", function () {
                HighlightPath(row)
            });
        },
    });

    new SimpleBar($('#paths-table_wrapper').find('.dataTables_scrollBody')[0]);
}

function HighlightPath(row) {
    let table = $("#paths-table").DataTable();
    let pathID = table.row(row).data()[9];
    let tableRows = $("#paths-table tr");
    tableRows.removeClass("selected");

    if (pathHighlighted.indexOf(pathID) > -1) {
        pathClicked = null;
        pathHighlighted = [];
        Graph
            .linkColor("color")
            .linkDirectionalParticleWidth(0)
            .linkDirectionalParticles(0)
            .linkDirectionalParticleSpeed(0)
    } else {
        pathClicked = pathID;

        if (pathsAreFolded) {
            pathHighlighted = [];
            table.rows().every( function () {
                let rowPathID = this.data()[9];
                if (rowPathID.split("/")[0] === pathID.split("/")[0]) {
                    pathHighlighted.push(rowPathID);
                    $(this.node()).addClass("selected");
                }
            });
            pathID =  pathID.split("/")[0]
        } else {
            pathHighlighted.push(pathID);
            $(row).addClass("selected");
        }

        Graph
            .linkDirectionalParticleWidth((link => link["path_id"] === pathID ? 4 : 0))
            .linkDirectionalParticles((link => link["path_id"] === pathID ? 4 : 0))
            .linkDirectionalParticleSpeed((link => link["path_id"] === pathID ? link["speed"] : 0));
        FillPathInfo(pathID)
    }
}

function ApplyTimeFilter(data) {
    let table = $("#paths-table").DataTable();
    let tableRows = $("#paths-table tr");
    tableRows.removeClass("selected");

    pathHighlighted = [];

    let fromTime = new Date(data.from);
    let toTime = new Date(data.to);

    table.rows().every( function () {
        let rowPathID = this.data()[9];
        let currentTime = moment(this.data()[4], "DD/MM/YYYY h:mm:ss a");
        if (fromTime <= currentTime && currentTime <= toTime) {
            pathHighlighted.push(rowPathID);
            $(this.node()).addClass("selected");
        } else {
            $(this.node()).removeClass("selected");
        }
    });

    Graph
        .linkDirectionalParticleWidth(link => pathHighlighted.indexOf(link["path_id"]) > -1 ? 4 : 0)
        .linkDirectionalParticles(link => pathHighlighted.indexOf(link["path_id"]) > -1 ? 4 : 0)
        .linkDirectionalParticleSpeed(link => pathHighlighted.indexOf(link["path_id"]) > -1 ? link["speed"] : 0);

}

function FillPathInfo(pathID) {

    let links = graphData.links;

    let chartLinks = [];

    for (let i =0; i < links.length; i++) {
        if (pathID === links[i]["path_id"]) {
            chartLinks.push(links[i]);
        }
    }

    chartLinks = chartLinks.sort((a, b) => (a["path_fragment"] > b["path_fragment"]) ? 1 : -1);

    let labels = [];
    let data = [];
    let numbers = [];
    let backgroundColors = [];

    let fromNode = null;
    let toNode = null;

    for (let i = 0; i < chartLinks.length; i++) {
        if (pathsAreFolded) {
            if (typeof chartLinks[i]["avg_distance"] === "number") {
                numbers.push(chartLinks[i]["avg_distance"]);
            }
        } else {
            if (typeof chartLinks[i]["distance"] === "number") {
                numbers.push(chartLinks[i]["distance"]);
            }
        }
    }

    let sum, avg = 0;
    if (numbers.length) {
        sum = numbers.reduce(function(a, b) { return a + b; });
        avg = sum / numbers.length;
    }

    let defaultZeroScale = avg;
    for (let i = 0; i < chartLinks.length; i++) {
        switch (i) {
            case 0:
                labels.push("src_host to src");
                data.push(defaultZeroScale);
                backgroundColors.push("#b4448ba1");
                break;
            case 1:
                labels.push("src to 0");
                data.push(defaultZeroScale);
                backgroundColors.push("#b4448ba1");
                break;
            case chartLinks.length -2:
                labels.push(i-2 + " to dest");
                data.push(defaultZeroScale);
                backgroundColors.push("#448cb4a1");
                break;
            case chartLinks.length -1:
                labels.push("dest to dest_host");
                data.push(defaultZeroScale);
                backgroundColors.push("#448cb4a1");
                break;
            default:
                fromNode = i-2;
                toNode = i-1;
                labels.push(fromNode + " to " + toNode);
                if (chartLinks[i]["source"]["id"].indexOf("Missed") > -1) {
                    data.push(defaultZeroScale);
                    backgroundColors.push("#b00000a1");
                } else {
                    if (chartLinks[i]["target"]["id"].indexOf("Missed") > -1) {
                        data.push(defaultZeroScale);
                        backgroundColors.push("#b00000a1");
                    } else {
                        if (pathsAreFolded) {
                            data.push(chartLinks[i]["avg_distance"]);
                        } else {
                            data.push(chartLinks[i]["distance"]);
                        }
                        backgroundColors.push("#8d8d8da1");
                    }
                }
                break;
        }
    }

    pathChart.data = {
        labels: labels,
        datasets: [{
            label: 'Path (' + pathID + ')',
            backgroundColor: backgroundColors,
            borderColor: backgroundColors,
            data: data
        }],
    };
    pathChart.update();

    let tableData = [];
    for (let i = 0; i < chartLinks.length; i++) {
        let strikeOut = false;
        if (chartLinks[i]["incomplete"]) {
            if (i === chartLinks.length -2 || i === chartLinks.length -1) {
                strikeOut = true
            }
        }

        if (pathsAreFolded) {
            tableData.push([
                chartLinks[i]["source"]["id"],
                chartLinks[i]["target"]["id"],
                chartLinks[i]["distance_mask"],
                chartLinks[i]["path_fragment"],
                strikeOut
            ]);
        } else {
            tableData.push([
                chartLinks[i]["source"]["id"],
                chartLinks[i]["target"]["id"],
                chartLinks[i]["distance_mask"],
                chartLinks[i]["path_fragment"],
                strikeOut
            ]);
        }
    }

    let table = $("#path-distance-table");
    table.DataTable().destroy();
    table.DataTable({
        bLengthChange: false,
        scrollY: 410,
        data: tableData,
        paging: false,
        ordering: false,
        colReorder: {
            order: [3]
        },
        columns: [
            {title: "From"},
            {title: "To"},
            {title: "Distance"},
            {title: "Fragment"},
            {title: "Strike out"},
        ],
        columnDefs:[
            {targets:[0, 1], className:"long-td"},
            {targets:[3, 4], visible: false},
            {targets:[2], className:"text-center-td"},
        ],
        createdRow: function(row){
            StrikeOutPathInfoLune(row)
        },
    });

     new SimpleBar($("#path-info").find('.dataTables_scrollBody')[0]);

     $("#path-chart").mouseout(function () {
         table.find("tr").removeClass("selected");
         Graph.linkColor(link => link["color"]);
     });
}

function StrikeOutPathInfoLune(row) {
    let table = $("#path-distance-table").DataTable();
    let strikeOut = table.row(row).data()[4];
    if (strikeOut) {
        $(row).each(function () {
            $(this).addClass("strike-out")
        })
    }
}

function AddToBucket(row, bucketName) {
    let bucket = $(row).closest(".query-item-wrapper").find(".bucket-wrapper");
    let item = $(row).find("td.long-td").text();
    if (buckets[bucketName].indexOf(item) < 0) {
        bucket.append("<div class='bucket-item' onclick='RemoveFromBucket(this)'>" + item + "</div>");
        buckets[bucketName].push(item)
    }

    let indicator = bucket.closest(".query-item").find(".filter-indicator");
    indicator.text(bucket.find('.bucket-item').length);

    SwitchApplyPulse()
}

function RemoveFromBucket(bucketItem) {
    let bucketName = $(bucketItem).closest('.bucket-wrapper').data('bucket-name');
    let item = $(bucketItem).text();
    let index = buckets[bucketName].indexOf(item);
    if (index >= 0) {
        buckets[bucketName].splice(index, 1);
        $(bucketItem).remove()
    }

    let bucket = $(".bucket-wrapper[data-bucket-name='" + bucketName + "']");
    let indicator = bucket.closest(".query-item").find(".filter-indicator");
    indicator.text(bucket.find('.bucket-item').length);

    SwitchApplyPulse()
}

function EmptyBucket(indicator) {
    let bucketItems = $(indicator).closest(".query-item").find(".bucket-item");
    for (let i = 0; i < bucketItems.length; i++) {
        bucketItems.eq(i).click()
    }

    SwitchApplyPulse()
}

function DataTablesInit(){
    $("#paths-table").DataTable({
        bLengthChange: false,
        scrollY: 225,
        columns: [
            {title: "Source"},
            {title: "Source site"},
            {title: "Source host"},
            {title: "IPv6"},
            {title: "Timestamp"},
            {title: "Destination"},
            {title: "Destination site"},
            {title: "Destination host"},
            {title: "Incomplete"},
            {title: "Path ID"}
        ],
        columnDefs:[
            {targets:[3], className:"text-center-td"},
            {targets:[4], className:"no-text-wrap"},
            {targets:[0, 1, 2, 4, 5, 6, 7], className:"long-td"},
            {targets:[8], className:"text-center-td"},
            {targets: [9], visible: false}
        ],
    });

    $("#path-distance-table").DataTable({
        bLengthChange: false,
        scrollY: 410,
        paging: false,
        ordering: false,
        columns: [
            {title: "From"},
            {title: "To"},
            {title: "Distance"},
            {title: "Fragment"},
            {title: "Strike out"},
        ],
        columnDefs:[
            {targets:[0, 1], className:"long-td"},
            {targets:[3, 4], visible: false},
            {targets:[2], className:"text-center-td"},
        ],
    });
}

function SwitchApplyPulse() {
    let apply = $("#query-constructor-apply button");

    if (JSON.stringify(currentQuery.query) === JSON.stringify(GenerateQuery())) {
        apply.removeClass("pulse")
    } else {
        apply.addClass("pulse")
    }
}

function UpdateTimeFilter(fromTime, toTime){
    let fromTimeUnix = moment(fromTime, "DD/MM/YYYY h:mm:ss a").valueOf();
    let toTimeUnix = moment(toTime, "DD/MM/YYYY h:mm:ss a").valueOf();


    let rangeSlider = $("#time-filter").data("ionRangeSlider");
    rangeSlider.update({
        min: fromTimeUnix,
        max: toTimeUnix,
        from: fromTimeUnix,
        to: toTimeUnix,
    });
}

function tsToDate (ts) {
    let d = new Date(ts);

    return d.toLocaleDateString("ru-ru", {
        hour: "numeric",
        minute: "numeric",
        second: "numeric"
    });
}


$(document).ready( function () {
    $(function () {
        let fromDatetime = $('#from-datetime');
        let toDatetime = $('#to-datetime');

        fromDatetime.datetimepicker({
            format: 'DD/MM/YYYY hh:mm:ss A',
        });
        toDatetime.datetimepicker({
            useCurrent: false,
            format: 'DD/MM/YYYY hh:mm:ss A',
        });
        fromDatetime.on("dp.change", function (e) {
            toDatetime.data("DateTimePicker").minDate(e.date);
            SwitchApplyPulse()
        });
        toDatetime.on("dp.change", function (e) {
            fromDatetime.data("DateTimePicker").maxDate(e.date);
            SwitchApplyPulse()
        });
    });

    for (let i = 0; i < filters.length; i++) {
        $("#" + filters[i][0] + "-bucket-table").DataTable({
            bLengthChange: false,
            scrollY: 225,
            columns: [
                {title: filters[i][1]},
                {title: "Count"}
            ],
        });
    }

    DataTablesInit();

    $("#distance-power").change(function () {
        updateLinkDistance()
    });

    $("#fold-path-switcher").change(function () {
        FoldUpPaths()
    });

    $("#dag-switcher").change(function () {
        SwitchDAGmode()
    });

    $("#time-filter").ionRangeSlider({
        skin: "flat",
        type: "double",
        grid: true,
        drag_interval: true,
        disable: true,
        prettify: tsToDate,
        onChange: function (data) {
            ApplyTimeFilter(data)
        }
    });

    $("#dimensions-switcher-container input").change(function () {
        SwitchDimensions(this)
    });

    $("#ipv-form input").change(function () {
        SwitchIPv(this)
    });

    setTimeout(function () {
        DispatchUrlQuery();
        DoQuery();
        setTimeout(function () {
            $("#preloader").css("display", "none");
            $("main").css("opacity", 1);
        }, 1000)
    }, 1000);

    setTimeout(function () {
        let nameLabel = $("#info-container span");
        setTimeout(function () {
            nameLabel.css("opacity", 0);
            setTimeout(function () {
                let showGuidelines = $("#show-guidelines");
                showGuidelines.addClass("pulse");
                showGuidelines.css("opacity", 1);
                setTimeout(function () {
                    $("#info-container").hide()
                }, 1500);
                setTimeout(function () {
                    showGuidelines.removeClass("pulse");
                }, 10000)
            }, 1500)
        }, 300)
    }, 1500)
} );
