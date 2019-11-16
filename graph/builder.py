from collections import defaultdict
from dataclasses import dataclass
from math import pi

from elasticsearch import Elasticsearch, RequestError
from datetime import datetime

from PSTraceGraph3D.settings import ES_HOSTS, ES_USER, ES_PASSWORD, ES_INDEX


def from_unix_timestamp(timestamp):
    try:
        timestamp = int(timestamp)
    except ValueError:
        return "-"

    dt = datetime.utcfromtimestamp(int(timestamp)/1000).strftime('%d/%m/%Y %H:%M:%S %p')

    return dt


class ColorSchemeMixin:
    hop_color = "#8d8d8d"
    src_color = "#b4448b"
    dest_color = "#448cb4"
    missing_color = "#b00000"
    incomplete_color = "#b00000"


@dataclass
class Node(ColorSchemeMixin):
    id: str
    path_hash: str
    label: str = None
    color: str = None
    rtt: int = None
    shape: str = "sphere"

    def __str__(self):
        return f"Id: {self.id} | Path: {self.path_hash}"

    def __post_init__(self):
        if self.color is None:
            self.color = self.hop_color
        else:
            self.color = self.__getattribute__(self.color)

        if self.label is None:
            self.label = self.id

    def register(self, nodes, integrity_buffer):
        if self.id not in integrity_buffer:
            integrity_buffer.append(self.id)
            nodes.append(self.__dict__)


@dataclass
class Link(ColorSchemeMixin):
    source: Node
    target: Node
    path_fragment: int
    path_hash: str
    path_id: str = None
    curvature: float = None
    rotation: float = None
    distance: float = 20.0
    distance_mask: str = "No data"
    speed: float = 1.0
    color: str = None
    folded: bool = False
    incomplete: bool = False

    def __str__(self):
        return f"Id: {self.path_id} | Path: {self.path_hash}"

    def __post_init__(self):
        if self.color is None:
            self.color = self.hop_color
        else:
            self.color = self.__getattribute__(self.color)

        try:
            distance = round(self.target.rtt - self.source.rtt, 3)
            if distance > 0:
                self.distance = distance
                self.distance_mask = distance
        except TypeError:
            pass

        if self.distance <= 0:
            self.speed = round(0.1 * (1 / (1 ** (1 / 2))), 2)
        else:
            self.speed = round(0.1 * (1 / (self.distance ** (1 / 2))), 2)

        if self.speed <= 0:
            self.speed = 0.3

    def register(self, links, links_counter, paths_counter):
        self.path_id = f"{self.path_hash}/{paths_counter[self.path_hash]}"

        links_counter[self.source.id] += 1
        counter = links_counter[self.source.id]

        self.curvature = 0.1 * counter
        self.rotation = round(pi * counter / 6, 3)

        self.source = self.source.id
        self.target = self.target.id

        links.append(self.__dict__)


class Graph(ColorSchemeMixin):

    def __init__(self, query):
        self.query = query

        if ES_USER and ES_PASSWORD:
            self.es_connection = Elasticsearch(hosts=ES_HOSTS, http_auth=(ES_USER, ES_PASSWORD))
        else:
            self.es_connection = Elasticsearch(hosts=ES_HOSTS)

        try:
            self.response = self.es_connection.search(index=ES_INDEX, body=self.query)
        except RequestError as e:
            self.response = self.request_error_handling(e)

        self.number_of_hits = 0
        self.nodes_integrity_buffer = []
        self.nodes = []
        self.links = []
        self.links_counter = defaultdict(int)
        self.paths_counter = defaultdict(int)
        self.nodes_folded_links_counter = defaultdict(int)
        self.the_end = None

        self.max_datetime = None
        self.min_datetime = None

        self.table_data = []

    def request_error_handling(self, error):
        if error.error == "search_phase_execution_exception":
            for agg_key in self.query["aggs"]:
                self.query["aggs"][agg_key]["terms"]["field"] = f"{agg_key}.keyword"

            response = self.es_connection.search(index=ES_INDEX, body=self.query)
        else:
            raise error

        return response

    def build(self, max_nodes):
        delta = self.query["from"]
        self.number_of_hits = 0
        self.the_end = True

        if self.response["hits"]["hits"]:
            for self.number_of_hits, hit in enumerate(self.response["hits"]["hits"]):
                self.sort_datetime(hit)
                next_nodes, next_links, incomplete = self.process_path_data(hit)
                if len(self.nodes) + len(next_nodes) > max_nodes:
                    self.the_end = False
                    break
                else:
                    self.nodes += next_nodes
                    self.links += next_links

                    self.insert_path_to_table_data(hit["_source"], incomplete=incomplete)

        self.build_folded_links()

        self.number_of_hits += delta

    def sort_datetime(self, hit):
        timestamp = hit["_source"]["timestamp"]
        date_time = from_unix_timestamp(timestamp)
        if self.max_datetime is None:
            self.max_datetime = date_time
        else:
            if self.max_datetime < date_time:
                self.max_datetime = date_time

        if self.min_datetime is None:
            self.min_datetime = date_time
        else:
            if self.min_datetime > date_time:
                self.min_datetime = date_time

    def process_path_data(self, hit):
        nodes = []
        links = []

        path = hit["_source"]

        self.paths_counter[path.get("hash")] += 1
        path_fragment = 1

        src_host = Node(path.get("src_host"), path.get("hash"), color="src_color", shape="large_sphere")
        src_host.register(nodes, self.nodes_integrity_buffer)

        src = Node(path.get("src"), path.get("hash"), color="src_color")
        src.register(nodes, self.nodes_integrity_buffer)

        src_host__src__link = Link(src_host, src, path_fragment, path.get("hash"), color="src_color")
        src_host__src__link.register(links, self.links_counter, self.paths_counter)

        previous_node = src
        hops = sorted(zip(path.get("ttls"), path.get("hops"), path.get("rtts")))
        hops = self.fix_missing_hops(hops, path.get("hash"))

        for i, hop in enumerate(hops, 1):
            path_fragment += 1

            color = "hop_color"
            if "Missed node" in hop[1]:
                color = "missing_color"
            elif i == len(hops):
                color = "dest_color"

            current_node = Node(hop[1], path.get("hash"), rtt=hop[2], color=color)
            current_node.register(nodes, self.nodes_integrity_buffer)

            link = Link(previous_node, current_node, path_fragment, path.get("hash"), color=color)
            link.register(links, self.links_counter, self.paths_counter)

            previous_node = current_node

        path_fragment += 1
        dest_host = Node(path.get("dest_host"), path.get("hash"), color="dest_color", shape="large_sphere")
        dest_host.register(nodes, self.nodes_integrity_buffer)

        if path.get("dest") != previous_node.id:
            dest = Node(path.get("dest"), path.get("hash"), color="dest_color")
            dest.register(nodes, self.nodes_integrity_buffer)

            previous_node__dest__link = Link(previous_node, dest, path_fragment, path.get("hash"), color="dest_color")
            previous_node__dest__link.register(links, self.links_counter, self.paths_counter)

            path_fragment += 1
            dest__dest_host__link = Link(dest, dest_host, path_fragment, path.get("hash"), color="dest_color")
            dest__dest_host__link.register(links, self.links_counter, self.paths_counter)

            self.mark_path_as_incomplete(nodes, links)

            incomplete = True
        else:
            previous_node__dest_host__link = Link(previous_node, dest_host, path_fragment, path.get("hash"),
                                                  color="dest_color")
            previous_node__dest_host__link.register(links, self.links_counter, self.paths_counter)

            incomplete = False

        return nodes, links, incomplete

    def mark_path_as_incomplete(self, nodes, links):
        for node in nodes:
            node["color"] = self.incomplete_color

        for link in links:
            link["color"] = self.incomplete_color
            link["incomplete"] = True

    def get_graph_data(self):
        graph_data = {
            "nodes": self.nodes,
            "links": self.links
        }

        return graph_data

    def build_folded_links(self):
        integrity_buffer = []
        nodes_links_counter = defaultdict(int)
        links_distances = defaultdict(list)

        for link in self.links:
            source_id = link["source"]
            target_id = link["target"]
            path_hash = link["path_hash"]

            if link["distance"] > 0 and link["distance_mask"] != "No data":
                links_distances[f"{source_id}-{target_id}-{path_hash}"].append(link["distance"])

        folded_links = []
        for link in self.links:
            source_id = link["source"]
            target_id = link["target"]
            path_hash = link["path_hash"]
            path_fragment = link["path_fragment"]

            if f"{source_id}-{target_id}-{path_hash}" not in integrity_buffer:
                integrity_buffer.append(f"{source_id}-{target_id}-{path_hash}")

                nodes_links_counter[source_id] += 1
                counter = nodes_links_counter[source_id]

                curvature = 0.1 * counter
                rotation = round(pi * counter / 6, 3)

                distances = links_distances[f"{source_id}-{target_id}-{path_hash}"]
                if distances:
                    average_distance = round(sum(distances)/len(distances), 3)
                    distance_mask = average_distance
                else:
                    distance_mask = f"No data"
                    average_distance = 0

                if average_distance <= 0:
                    speed = 0.3
                    average_distance = "No data"
                else:
                    speed = round(0.1 * (1 / (average_distance ** (1 / 2))), 2)

                if speed < 0.3:
                    speed = 0.3

                link = {
                    "path_id": f"{path_hash}",
                    "source": source_id,
                    "target": target_id,
                    "path_fragment": path_fragment,
                    "curvature": curvature,
                    "rotation": rotation,
                    "distance_mask": distance_mask,
                    "avg_distance": f"{average_distance}",
                    "speed": speed,
                    "color": link["color"],
                    "path_hash": f"{path_hash}",
                    "folded": True,
                    "incomplete": link["incomplete"]
                }

                folded_links.append(link)

        self.links += folded_links

    def get_aggregations(self):
        aggregations = self.response["aggregations"]
        keys = ["src", "src_site", "src_host", "dest", "dest_site", "dest_host"]
        data = {}
        for key in keys:
            data[key] = [(bucket["key"], bucket["doc_count"]) for bucket in aggregations[key]["buckets"]]

        return data

    def insert_path_to_table_data(self, path, incomplete=False):

        path_hash = path.get("hash")

        table_item = [
            path.get("src", "-"),
            path.get("src_site", "-"),
            path.get("src_host", "-"),
            path.get("ipv6", "-"),
            from_unix_timestamp(path.get("timestamp", "-")),
            path.get("dest", "-"),
            path.get("dest_site", "-"),
            path.get("dest_host", "-"),
            incomplete,
            f"{path_hash}/{self.paths_counter[path_hash]}"
        ]

        self.table_data.append(table_item)

    @staticmethod
    def fix_missing_hops(hops, path_hash):
        new_hops = []

        hop_map = {h[0]: h[0:] for h in hops}
        for i in range(1, hops[-1][0] + 1):
            hop = hop_map.get(i, None)
            if hop is None:
                hop = (i, f"Missed node ({i}) at path: {path_hash}", None)
            new_hops.append(hop)

        return new_hops
