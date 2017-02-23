'''
Created on Sept 10, 2016
@author: Bob Strahan, AWS Professional Services

Wrapper to elasticsearch for indexing dataframes

Methods:

- constructor (__init__)
    Initialize elasticsearch interface
    Parameters:
    - esnodes (str) - hostname and port for elasticsearch or es-proxy endpoint
    - esport (int) - port number for elasticsearch or es-proxy endpoint

- deleteIndex(self,index="*"):
    Deletes an existing index and all data in the index
    Parameters:
    - index (str) - Name of elasticsearch index to be deleted

- createOrReplaceIndex(self, index, mapping=None):
    Creates a new index. If index already exists it will be deleted and replaced.
    The default mapping will create two copies of each string variable - one not_analysed, and one analysed to support UI text search.
    Parameters:
    - index (str) - Name of elasticsearch index to be created
    - mapping (str) - Optional JSON mapping to create fields in the index - overrides default

- addTypeMapping(self, index, doctype, mapping):
    Adds an optional mapping for a doc type in an existing index. 
    Type mappings map be used to override default index mappings for specific variables.
    Parameters:
    - index (str) - Name of elasticsearch index
    - doctype (str) - Name of elasticsearch doctype
    - mapping (str) - JSON mapping for the doctype  
    
- saveToEs(self,dflist,index,doctype):
    Saves a spark data frame to a target elasticsearch index/doctype
    Parameters:
    - dflist (dataframe, or list of dataframes) - spark dataframe(s) to index
    - index (str) - Name of elasticsearch index
    - doctype (str) - Name of elasticsearch doctype
    
'''
import subprocess
import json


class esindex(object):

    def __init__(self,esnodes='localhost',esport=9200):
        self.esnodes = esnodes
        self.esport = str(esport)

    def deleteIndex(self,index="*"):
        index=index.lower()
        es_url='http://%s:%s/%s' % (self.esnodes, self.esport, index)
        cmd = 'curl -XDELETE \'%s\'' % es_url
        response = subprocess.check_output(cmd, shell=True)
        if "index_not_found_exception" in response:
            print("No existing elasticsearch index (%s)" % index)
        elif '{"acknowledged":true}' not in response:
            raise ValueError('Failed setting ElasticSearch Default Mapping Template') 
        else:
            print ('Deleted existing elasticsearch documents (%s)' % index)

    def createOrReplaceIndex(self, index, mapping=None):
        self.deleteIndex(index)
        index=index.lower()
        # strings preserved as not_analyzed, plus additional "split" index using the
        # standard string analyzer to support case insensitive text substring queries 
        default_mapping =  """
            {
                "mappings": {
                    "_default_": {
                        "_all": {
                            "enabled": true
                        },
                        "dynamic_templates": [
                            {
                              "strings": {
                                "match_mapping_type": "string",
                                "mapping": {
                                  "type": "string",
                                  "index": "not_analyzed",
                                  "fields": {
                                    "split": {
                                      "type":  "string",
                                      "index": "analyzed"
                                    }
                                  }
                                }
                              }
                            }
                        ]
                    }
                }
            }
        """
        if not mapping:
            mapping=default_mapping
        cmd = 'curl -XPUT \'http://{0}:{1}/{2}\' -d \'{3}\''.format(self.esnodes, self.esport, index, mapping)
        response_json = subprocess.check_output(cmd, shell=True)
        print ('Create index <{0}> response: {1}'.format(index, response_json))
        response = json.loads(response_json)
        if not ('acknowledged' in response and response['acknowledged'] == True):
            raise ValueError('Failed setting ElasticSearch Default Mapping Template')

    def addTypeMapping(self, index, doctype, mapping):
        index=index.lower()
        cmd = 'curl -XPUT \'http://{0}:{1}/{2}/_mapping/{3}\' -d \'{4}\''.format(self.esnodes, self.esport, index, doctype, mapping)
        response_json = subprocess.check_output(cmd, shell=True)
        print ('Add type mapping for <{0}.{1}> response: {2}'.format(index, doctype, response_json))
        response = json.loads(response_json)
        if not ('acknowledged' in response and response['acknowledged'] == True):
            raise ValueError('Failed setting ElasticSearch mapping')
                  
    def saveToEs(self,dflist,index,doctype):
        index=index.lower()
        c=0
        if type(dflist) is not list:
            dflist = [dflist]
        for df in dflist:
            rdd = df.rdd.map(lambda row: ('key', row.asDict()))
            es_conf = {
                "es.nodes" : self.esnodes,
                "es.port" : self.esport,
                "es.nodes.wan.only" : "true",
                "es.resource" : "%s/%s" % (index, doctype),
                "es.batch.write.retry.count" : "50",
                "es.batch.write.retry.wait" : "20"
                }
            rdd.saveAsNewAPIHadoopFile(
                path='-',
                outputFormatClass="org.elasticsearch.hadoop.mr.EsOutputFormat",
                keyClass="org.apache.hadoop.io.NullWritable",
                valueClass="org.elasticsearch.hadoop.mr.LinkedMapWritable",
                conf=es_conf
                )
            c=c+1
            print("Dataset %d saved to elasticsearch <%s/%s>" % (c, index, doctype))
