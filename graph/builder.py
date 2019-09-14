from collections import defaultdict
from math import pi

from elasticsearch import Elasticsearch
from datetime import datetime

from PSTraceGraph3D.settings import ES_HOSTS, ES_USER, ES_PASSWORD, ES_INDEX


def from_unix_timestamp(timestamp):
    try:
        timestamp = int(timestamp)
    except ValueError:
        return "-"

    dt = datetime.utcfromtimestamp(int(timestamp)/1000).strftime('%d/%m/%Y %H:%M:%S %p')

    return dt


class Graph:
    default_colour = "#8d8d8d"
    src_colour = "#b4448b"
    dest_colour = "#448cb4"
    ghost_colour = "#b00000"

    def __init__(self, query):
        self.query = query

        if ES_USER and ES_PASSWORD:
            self.es_connection = Elasticsearch(hosts=ES_HOSTS, http_auth=(ES_USER, ES_PASSWORD))
        else:
            self.es_connection = Elasticsearch(hosts=ES_HOSTS)

        self.response = self.es_connection.search(index=ES_INDEX, body=self.query)

        self.number_of_hits = 0
        self.integrity_buffer = []
        self.nodes = []
        self.links = []
        self.nodes_links_counter = defaultdict(int)
        self.path_counter = defaultdict(int)
        self.nodes_integral_links_counter = defaultdict(int)
        self.the_end = None

        self.table_data = []

    def build(self, max_nodes):
        delta = self.query["from"]
        self.number_of_hits = 0
        self.the_end = True

        if self.response["hits"]["hits"]:
            for self.number_of_hits, hit in enumerate(self.response["hits"]["hits"]):
                next_nodes, next_links = self.process_path_data(hit)

                if len(self.nodes) + len(next_nodes) > max_nodes:
                    self.the_end = False
                    break
                else:
                    self.nodes += next_nodes
                    self.links += next_links

        self.build_integral_links()

        self.number_of_hits += delta

    def process_path_data(self, hit):
        nodes = []
        links = []

        path = hit["_source"]

        self.path_counter[path.get("hash")] += 1
        self.insert_path_to_table_data(path)
        path_fragment = 1

        src_host = self.assemble_node(path.get("src_host"), nodes, path.get("hash"), colour=self.src_colour)
        src = self.assemble_node(path.get("src"), nodes, path.get("hash"), colour=self.src_colour)
        links.append(self.assemble_link(src_host, src, path_fragment, path.get("hash"), colour=self.src_colour))

        previous_node = src
        hops = sorted(zip(path.get("ttls"), path.get("hops"), path.get("rtts")))
        hops = self.fix_ghost_hops(hops, path.get("hash"))

        for i, hop in enumerate(hops, 1):
            path_fragment += 1

            colour = self.default_colour
            if "Missed node" in hop[1]:
                colour = self.ghost_colour
            elif i == len(hops):
                colour = self.dest_colour

            current_node = self.assemble_node(hop[1], nodes, path.get("hash"), rtt=hop[2], colour=colour)
            links.append(self.assemble_link(previous_node, current_node, path_fragment, path.get("hash"),
                                            colour=colour))

            previous_node = current_node

        path_fragment += 1
        dest_host = self.assemble_node(path.get("dest_host"), nodes, path.get("hash"), colour=self.dest_colour)
        links.append(self.assemble_link(previous_node, dest_host, path_fragment, path.get("hash"),
                                        colour=self.dest_colour))

        return nodes, links

    def assemble_node(self, node, nodes, path_hash, rtt=None, colour=None):
        if not colour:
            colour = self.default_colour

        node = {
            "id": node,
            "label": node,
            "colour": colour,
            "path_hash": path_hash,
            "rtt": rtt
        }

        if node["id"] not in self.integrity_buffer:
            self.integrity_buffer.append(node["id"])
            nodes.append(node)

        return node

    def assemble_link(self, source, target, path_fragment, path_hash, colour=None):

        if not colour:
            colour = self.default_colour

        self.nodes_links_counter[source["id"]] += 1
        counter = self.nodes_links_counter[source["id"]]

        curvature = 0.1 * counter
        rotation = round(pi * counter / 6, 3)

        try:
            distance = round(target["rtt"] - source["rtt"], 3)
            distance_mask = distance

            if distance < 0:
                distance = 0
                distance_mask = "No data"
        except TypeError:
            distance = 0
            distance_mask = "No data"

        if distance <= 0:
            speed = round(0.1 * (1 / (1 ** (1 / 2))), 2)
        else:
            speed = round(0.1 * (1 / (distance ** (1 / 2))), 2)

        link = {
            "path_id": f"{path_hash}/{self.path_counter[path_hash]}",
            "path_fragment": path_fragment,
            "source": source["id"],
            "target": target["id"],
            "curvature": curvature,
            "rotation": rotation,
            "distance_mask": distance_mask,
            "distance": distance,
            "speed": speed,
            "colour": colour,
            "path_hash": f"{path_hash}",
            "integral": False
        }

        return link

    def get_graph_data(self):
        graph_data = {
            "nodes": self.nodes,
            "links": self.links
        }

        return graph_data

    def build_integral_links(self):
        integrity_buffer = []
        nodes_links_counter = defaultdict(int)
        links_distances = defaultdict(list)

        for link in self.links:
            source_id = link["source"]
            target_id = link["target"]
            path_hash = link["path_hash"]

            if link["distance"] > 0:
                links_distances[f"{source_id}-{target_id}-{path_hash}"].append(link["distance"])

        integral_links = []
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
                    distance_mask = f"Average: {average_distance}"
                else:
                    distance_mask = f"No data"
                    average_distance = 0

                if average_distance <= 0:
                    speed = round(0.1 * (1 / (1 ** (1 / 2))), 2)
                else:
                    speed = round(0.1 * (1 / (average_distance ** (1 / 2))), 2)

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
                    "colour": "#000000",
                    "path_hash": f"{path_hash}",
                    "integral": True
                }

                integral_links.append(link)

        self.links += integral_links

    def get_aggregations(self):
        aggregations = self.response["aggregations"]
        keys = ["src", "src_site", "src_host", "dest", "dest_site", "dest_host"]
        data = {}
        for key in keys:
            data[key] = [(bucket["key"], bucket["doc_count"]) for bucket in aggregations[key]["buckets"]]

        return data

    def insert_path_to_table_data(self, path):

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
            f"{path_hash}/{self.path_counter[path_hash]}",
        ]

        self.table_data.append(table_item)

    @staticmethod
    def fix_ghost_hops(hops, path_hash):
        new_hops = []

        hop_map = {h[0]: h[0:] for h in hops}
        for i in range(1, hops[-1][0] + 1):
            hop = hop_map.get(i, None)
            if hop is None:
                hop = (i, f"Missed node ({i}) at path: {path_hash}", None)
            new_hops.append(hop)

        return new_hops
