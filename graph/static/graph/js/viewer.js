
let shapes = {
    "large_sphere": new THREE.SphereGeometry(8, 32, 32),
    // "torus": new THREE.TorusGeometry(8, 2, 16, 25),
    // "torus_knot": new THREE.TorusKnotGeometry(6, 1),
    "sphere": new THREE.SphereGeometry(5, 32, 32)
};

let materialsOpacity = {
    "large_sphere": 0.75,
    "sphere": 0.5
};

const Graph = ForceGraph3D()(document.getElementById('graph-container'))
    .backgroundColor("#ffffff")
    .width($(window).width())
    .height($(window).height())
    .linkCurvature('curvature')
    .linkCurveRotation('rotation')
    .nodeLabel('label')
    .nodeColor("colour")
    .linkColor("colour")
    .linkDirectionalArrowLength(5)
    .linkDirectionalArrowRelPos(1)
    .linkVisibility(link => link['folded'] !== false)
    .linkLabel("avg_distance")
    .showNavInfo(false)
    .nodeThreeObject(({ shape, colour }) => new THREE.Mesh(
        shapes[shape],
        new THREE.MeshBasicMaterial({
            color: colour,
            depthWrite: true,
            transparent: true,
            opacity: materialsOpacity[shape]
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
    })
    .onNodeDragEnd(node => {
        node.fx = node.x;
        node.fy = node.y;
        node.fz = node.z;
    });

const linkForce = Graph
    .d3Force('link')
    .distance(link => (link["avg_distance"] > 0) ? link["avg_distance"] : (link["distance"] > 0) ? link["distance"] : 0.001);


function updateLinkDistance() {
    let power =  $("#distance-power").val();
    linkForce.distance(link => (link["avg_distance"] > 0) ? link["avg_distance"] * power : (link["distance"] > 0) ? link["distance"] * power : 0.001);
    Graph.numDimensions(3);
}

let graphData = null;

let pathHighlighted = [];
let pathClicked = null;

let currentQuery = {
    "query": null,
    "current_jump_index": 0,
    "jumps": [],
    "max_nodes": null
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

    return query
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
            "max_nodes": currentQuery.max_nodes
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

                let fromDatetime = $('#from-datetime');
                let toDatetime = $('#to-datetime');

                if (!fromDatetime.data("DateTimePicker").date() && !toDatetime.data("DateTimePicker").date()) {
                    fromDatetime.data("DateTimePicker").date(data["from_datetime"]);
                    toDatetime.data("DateTimePicker").date(data["to_datetime"]);

                    currentQuery.query = GenerateQuery()
                }

                SwitchApplyPulse()
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
        let rowPathID = this.data()[9];
        if (rowPathID === pathClickedBuffer) {
            $(this.node()).click();
        }
    });

    if (pathsAreFolded) {
        Graph
            .linkVisibility(link => link['folded'] !== true)
            .linkLabel("distance_mask");
        pathsAreFolded = false;
    } else {
        Graph
            .linkVisibility(link => link['folded'] !== false)
            .linkLabel("avg_distance");
        pathsAreFolded = true;
    }

    table.rows().every( function () {
        let rowPathID = this.data()[9];
        if (rowPathID === pathClickedBuffer) {
            $(this.node()).click();
        }
    });
}

function UpdateGraphData() {
    Graph.nodeColor("colour").linkColor("colour").graphData(graphData);
    if (pathsAreFolded) {
        Graph
            .linkVisibility(link => link['folded'] !== false)
            .linkLabel("avg_distance");

    } else {
        Graph
            .linkVisibility(link => link['folded'] !== true)
            .linkLabel("distance_mask");
    }

    Graph
        .linkDirectionalParticleWidth(0)
        .linkDirectionalParticles(0)
        .linkDirectionalParticleSpeed(0);

    updateLinkDistance()
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
            .linkColor("colour")
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
            .linkDirectionalParticleWidth((link => link["path_id"] === pathID ? 4 : 1))
            .linkDirectionalParticles((link => link["path_id"] === pathID ? 4 : 0))
            .linkDirectionalParticleSpeed((link => link["path_id"] === pathID ? link["speed"] : 0));
        FillPathInfo(pathID)
    }
}

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

                    Graph
                        .linkColor(link => (link['path_id'] === pathID) ? (link["path_fragment"] === fragment) ? "#00bfb3": link["colour"]: link["colour"]);

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
    let backgroundColors = [];

    let fromNode = null;
    let toNode = null;

    let defaultZeroScale = 1;
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
         Graph.linkColor(link => link["colour"]);
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

    setTimeout(function () {
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
                }, 2000);
                setTimeout(function () {
                    showGuidelines.removeClass("pulse");
                }, 10000)
            }, 1500)
        }, 300)
    }, 1500)
} );
