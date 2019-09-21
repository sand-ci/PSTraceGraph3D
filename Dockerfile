FROM python:3.6

ENV PYTHONUNBUFFERED 1

RUN mkdir /PSTraceGraph3D
WORKDIR /PSTraceGraph3D
ADD . /PSTraceGraph3D/

RUN pip install -r requirements.txt