FROM python:3.6

ENV PYTHONUNBUFFERED 1

RUN mkdir /ps_platform
WORKDIR /ps_platform
ADD . /ps_platform/

RUN pip install -r requirements.txt