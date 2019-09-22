import json

from django.http import JsonResponse
from django.shortcuts import render
from django.views import View

from graph.builder import Graph


class GraphViewer(View):
    template = "graph/viewer/viewer.html"

    def get(self, request):
        data = {}

        return render(request, self.template, data)


class GraphBuilder(View):
    max_nodes = 150

    def get(self, request):
        data = {
            "status": True,
            "message": "Everything is ok",
            "is_previous": True,
            "is_next": True
        }

        try:
            query, jumps, jump_to, current_jump_index, max_nodes = self.get_request_data(request)

            query = self.prepare_query(query)
            jump_index = self.prepare_jumps(jumps, current_jump_index, jump_to,  query)

            data["current_jump_index"] = jump_index

            graph = Graph(query)
            graph.build(max_nodes)

            graph_data = graph.get_graph_data()
            table_data = graph.table_data

            if jumps[0] == query["from"]:
                data["is_previous"] = False

            if jump_to == "next":
                if graph.number_of_hits == jumps[-1]:
                    data["is_next"] = False

            if graph.the_end:
                data["is_next"] = False

            if graph.number_of_hits > jumps[-1] and not graph.the_end:
                jumps.append(graph.number_of_hits)

            data["graph_data"] = graph_data
            data["table_data"] = table_data
            data["jumps"] = jumps
            data["aggregations"] = graph.get_aggregations()

        except Exception as error:
            data = {
                "status": False,
                "message": "Request failed",
                "error": str(error)
            }

        return JsonResponse(data)

    def get_request_data(self, request):
        query = request.GET.get("query", {})
        jumps = [int(i) for i in request.GET.get("jumps", "").split(",") if i.isdigit()]
        if not jumps:
            jumps = [0]
        current_jump_index = int(request.GET.get("current_jump_index", 0))
        jump_to = request.GET.get("jump_to", "")

        try:
            max_nodes = int(request.GET.get("max_nodes", ""))
        except ValueError:
            max_nodes = self.max_nodes

        return query, jumps, jump_to, current_jump_index, max_nodes

    def prepare_query(self, query):
        if not query:
            query = {
                "query": {
                    "match_all": {}
                },
                "sort": [
                    {
                        "timestamp": {
                            "order": "desc"
                        }
                    }
                ],
                "size": self.max_nodes
            }
        else:
            query = {
                "query": json.loads(query),
                "sort": [
                    {
                        "timestamp": {
                            "order": "desc"
                        }
                    }
                ],
                "size": self.max_nodes
            }

        query["aggs"] = {
            "src": {
                "terms": {"field": "src", "size": 1000}
            },
            "src_site": {
                "terms": {"field": "src_site", "size": 1000}
            },
            "src_host": {
                "terms": {"field": "src_host", "size": 1000}
            },
            "dest": {
                "terms": {"field": "dest", "size": 1000}
            },
            "dest_site": {
                "terms": {"field": "dest_site", "size": 1000}
            },
            "dest_host": {
                "terms": {"field": "dest_host", "size": 1000}
            }
        }

        return query

    @staticmethod
    def prepare_jumps(jumps, current_jump_index, jump_to, query):
        if not jumps:
            jumps = [0]

        if jump_to == "previous":
            jump_index = current_jump_index - 1
            if jump_index < 0:
                query["from"] = 0
            else:
                query["from"] = jumps[jump_index]
        elif jump_to == "next":
            jump_index = current_jump_index + 1
            try:
                query["from"] = jumps[jump_index]
            except IndexError:
                query["from"] = jumps[-1]
        elif jump_to == "stay":
            jump_index = current_jump_index
            query["from"] = jumps[jump_index]
        else:
            jump_index = 0
            query["from"] = jumps[jump_index]

        return jump_index
