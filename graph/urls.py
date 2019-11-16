from django.urls import path

from graph.views import GraphViewer, GraphBuilder

urlpatterns = [
    path("viewer", GraphViewer.as_view(), name="viewer"),
    path('ajax/builder', GraphBuilder.as_view(), name="graph_builder")
]
