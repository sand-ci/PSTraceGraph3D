# PSTraceGraph3D

## Short description
The tool is built on Django 2.0.2 and ElasticSearch as data source.
The tool helps to visualise paths between Source and Destination.

Demo video is available here: [PSTraceGraph3D Video](https://yadi.sk/i/Qf3lqBjKVz-YGA)

![alt text](https://github.com/ETretyakov/PSTraceGraph3D/blob/master/screenshot.png?raw=true)


## Configuration
To configure ElasticSearch you need to drop config file (*config.ini*) to **/PSTraceGraph3D** directory with following structure:
```
SECRET_KEY:&y&s3(9b0hvuxi)&ab80grj*^lpd@5665xnu&e+kqq=%+&wn^6
ES_HOSTS:http://localhost:9200/
ES_USER:admin
ES_PASSWORD:123456
ES_INDEX:my-es-index
```
