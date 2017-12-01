'''
Created on Sept 10, 2016
@author: Bob Strahan, AWS Professional Services

Encapsulate prototype variable definitions and methods for harmonization notebooks.

Methods:

- constructor (__init__)
    Defines standardized vargroups & standardised (harmonized) variables with associated metadata
        (A vargroup is used categorise related attributes, and is used to create accordian folders in the UI.)
    Parameters:
    - hiveContext (stored in the object and used by other methods when needed to run hive sql queries)

    
- addVarGroup(self,varGroup,order,default=False)
    Use to add an extra vargroup. 
    Parameters:
    - vargroup (str) - name of a new vargroup to be added
        (A vargroup is used categorise related attributes, and is used to create accordian folders in the UI.)
    - order (int) - user by UI to control the order in which vargroup accordian folders are displayed
    - default (bool) - if true, variables will be assigned to this vargroup by default, unless explicitly assigned to another.
        
- addVarMetadata(self, col, vargroup, type, descr, uifilter=True)
    Used to add optional metadata to non harmonized variables, to enrich the dictionary and to control widget used in the filter UI
    Parameters
    - col (str) - Name of variable/column
    - vargroup (str) - Name of vargroup
    - type (str) - Type of search widget assocaited with the attribute
        (datetime | boolean | range,vmin,vmax,step | enum,v1,v2,... | unknown)
    - descr (str) - Tooltip for the attribute
    - uifilter (bool) - True to display this attribute in the search UI, false to hide

- mapVar(self, df, oldvar, newvar, keepOrig=False)
    Renames a variable by mapping old name to new name in a spark dataframe. 
    Parameters:
    - df (dataframe) - Dataframe containing variables and values
    - oldvar (str) - Name of original variable
    - newvar (str) - Name of target variable
    - keepOrig (boolean) - By default this method replaces teh original variable. 
        Set to True to preserve the original variable in the dataframe 

- mapValues(self, df, col, valueMappings):
    Changes the values of a variable, mapping from old value to new value
    Parameters:
    - df (dataframe) - Dataframe containing variables and values
    - col (str) - name of variable/column
    - valueMappings (dict) - Map of original values to new, harmonized values

- addTransformDescr(self, col, transformDescr):
    Add a description of transformation, used to describe the algorithm that transformed raw data to its harmonized state.
    This is captured in the dictionary, and shown within the harmonization notebook to give users insight into how the 
    data owner modified the data.
    Parameters:
    - col (str) - Name of variable/column
    - transformDescr (str) - Description of transformation algorithm

- setColDataTypes(self,df):
    Set the data types for columns - if dataframe column type doesn't match expected column type for harmonized variable, 
    cast it to enforce datatype consistency for all harmonised variables.
    Parameters:
    - df (dataframe) - Dataframe containing variables and values

- makeValidVariableNames(self, df):
    Rename any variabes that have spaces or other characters not supported by parquet format. 
    Invalid chars for parquet format are: " ,;{}()\\n\\t=".
    Ensure all names are lowercase to accomodate Athena- see: http://docs.aws.amazon.com/athena/latest/ug/known-limitations.html
    Parameters:
    - df (dataframe) - Dataframe containing variables and values        

- get_unique_values(self, df, col):
    Return only the unique values of a variable - can be used to construct enum type values
    Parameters:
    - df (dataframe) - Dataframe containing variables and values         
    - col (str) - Variable for which to gather unique values

- buildDataDict(self,df):
    Builds and returns a new datframe containing a data dictionary with one row per variable from the input dataframe.
    The dictionary contains summary stats and descriptions for each variable, and metadata used by the search UI
    Parameters:
    - df (dataframe) - Dataframe containing variables and values          

- saveAsParquetTable(self,df,schema,table,s3path):
    Save dataframe as a SparkSQL table backed by S3 parquet files. 
    Returns a copy of the Athena compatable DDL for the table - used in executeAthenaDDL() to make the data acessible from Amazon Athena.
    Parameters:
    - df (dataframe) - Dataframe containing variables and values   
    - schema (str) - Schema name
    - table (str) - Table name
    - s3path (str) - Target S3 bucket and prefix for saving the parquet files

- executeAthenaDDL(self,athena_s3_staging_dir,ddlList):
    Save dataframe as a SparkSQL table backed by S3 parquet files. 
    Returns a copy of the Athena compatable DDL for the table - may be used by researchers access the data from Amazon Athena.
    Parameters:
    - athena_s3_staging_dir (str) - an s3 path uri to a bucket/prefix used by Athana
    - ddlList (list of str) - A string, or list of strings containing valid Athena DDL statements
    
- publishNotebookToS3(self, outputdocpath, notebook_urlbase, notebookName):
    Copies the notebook native and html formats from the local disk to S3 target dataset path. 
    The HTML version is made visible from the search & discover UI.
    Parameters:
    - outputdocpath (str) - S3 bucket/prefix for saving the notebook
    - notebook_urlbase (str) - URL for linking the HTML version of the notebook
    - notebookName (str) - Name of the notebook to be saved        
'''

from __future__ import print_function
import os
import subprocess
import time
import re
import pandas
import json
from pyspark import SparkContext
from pyspark.sql import HiveContext
from pyspark.sql.functions import *
import jaydebeapi

class harmonizeCrimeIncidents(object):

    def __init__(self, hiveContext):
        # List of variable groups used as Search UI accordian labels (displayed in the order specified)
        vargroups={
            "Date and Time"                :"00.Date and Time",
            "Incident"                     :"01.Incident",
            "Location"                     :"04.Location",
            "Miscellaneous"                :"99.Miscellaneous"
        }
        # list of harmonized variables
        #  - assign to vargroups category
        #  - assign a 'type' used by search filter UI to display appropriate selector
        #     - identifier | datetime | boolean | range,vmin,vmax,step | enum,v1,v2,... | unknown
        #  - assign a description - added to the data dictionary
        #  - assign 'uifilter' flag - determines whether variable is shown in the search UI
        harmonized_variables={
            ######################
            # Dataset descriptive variables
            ######################
            "notebookhtml" : {
                "group":vargroups["Miscellaneous"],
                "type": "text",
                "descr": "URL to Jupyter notebook containing documentation and code used to create this dataset.",
                "mapping":"N/A",
                "uifilter": False
            },
            "rawdatapath" : {
                "group":vargroups["Miscellaneous"],
                "type": "text",
                "descr": "S3 Path to raw dataset.",
                "mapping":"N/A",
                "uifilter": False
            },
            "harmonizeddatapath" : {
                "group":vargroups["Miscellaneous"],
                "type": "text",
                "descr": "S3 Path to harmonized dataset root prefix.",
                "mapping":"N/A",
                "uifilter": False
            },
            #######################
            # Incident variables
            #######################
            "datetime" : {
                "group":vargroups["Date and Time"],
                "type": "datetime", 
                "descr": "Incident date and time",
                "uifilter": True
            },
            "year" : {
                "group":vargroups["Date and Time"],
                "type": "range,2000,2017,1", 
                "descr": "Incident year",
                "uifilter": True
            },
            "month" : {
                "group":vargroups["Date and Time"],
                "type": "enum,1,2,3,4,5,6,7,8,9,10,11,12", 
                "descr": "Incident month",
                "uifilter": True
            },
            "day" : {
                "group":vargroups["Date and Time"],
                "type": "enum,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31", 
                "descr": "Incident date",
                "uifilter": True
            },
            "hour" : {
                "group":vargroups["Date and Time"],
                "type": "enum,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23", 
                "descr": "Incident hour",
                "uifilter": True
            },
            "minute" : {
                "group":vargroups["Date and Time"],
                "type": "range,0,59,1", 
                "descr": "Incident minute",
                "uifilter": True
            },
            "dayofweek" : {
                "group":vargroups["Date and Time"],
                "type": "enum,Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday", 
                "descr": "Incident day of week",
                "uifilter": True
            },
            "description" : {
                "group":vargroups["Incident"],
                "type": "text",
                "descr": "Incident description",
                "uifilter": True
            },
            "city" : {
                "group":vargroups["Location"],
                "type": "text",
                "descr": "Incident city",
                "uifilter": True
            },
            "location" : {
                "group":vargroups["Location"],
                "type": "text",
                "descr": "Incident location/address",
                "uifilter": True
            },
            "neighbourhood" : {
                "group":vargroups["Location"],
                "type": "text",
                "descr": "Incident neighborhood",
                "uifilter": True
            },
            "geolocation" : {
                "group":vargroups["Location"],
                "type": "text",
                "descr": "Incident geoLocation coordinates",
                "uifilter": False
            }
        }
        self.hc=hiveContext
        self.vargroups=vargroups
        self.defaultVargroup=None
        self.harmonized_variables=harmonized_variables
        self.addl_variables={}
        self.varmap={}
        self.varmapreverse={}
        self.transformDescr={}

    def addVarGroup(self,varGroup,order=98,default=False):
        self.vargroups[varGroup]="{0}.{1}".format(order,varGroup)
        if default:
            self.defaultVargroup = self.vargroups[varGroup]

    def addVarMetadata(self, col, vargroup, type, descr, uifilter=True):
        # lookup vargroup - if registered use the 'ordered' label.
        if vargroup in self.vargroups:
            vargroup = self.vargroups[vargroup]
        self.addl_variables[col] = {
                "field":col,
                "group":vargroup,
                "type": type,
                "descr": descr,
                "uifilter": uifilter
            }

    def mapVar(self, df, oldvar, newvar, keepOrig=False):
        if (newvar == oldvar):
            if not keepOrig:
                # noop mapping - new=old and no request to keep copy of old.
                print("original variable {0} already matched target variable name - making no changes".format(oldvar))
                return df
            else:
                # rename oldvar to be unique - append _orig
                oldvar2 = oldvar + "_orig"
                df = df.withColumnRenamed(oldvar, oldvar2)
                print("rename original variable {0} to {1}".format(oldvar,oldvar2)) 
                oldvar = oldvar2
        self.varmap[oldvar]=newvar
        self.varmapreverse[newvar]=oldvar
        df = df.withColumn(newvar, col(oldvar))
        print("New variable <{0}> created from <{1}>".format(newvar, oldvar))
        # drop original column, unless old is the same as the new except in case.. 
        if not keepOrig and not oldvar.lower() == newvar.lower():
            df = df.drop(oldvar)
            print("Dropped variable <{}>".format(oldvar))
        return df

    def mapValues(self, df, col, valueMappings):
        col_tmp = col + '_tmp'
        df = df.withColumnRenamed(col, col_tmp)
        caseExpr = "CASE {0} ".format(col_tmp)
        for oldval in valueMappings.keys():
            newval = valueMappings[oldval]
            caseExpr = caseExpr + "WHEN '{0}' THEN '{1}' ".format(oldval, newval)
        caseExpr = caseExpr + "ELSE {0} END AS {1}".format(col_tmp, col)
        df=df.selectExpr(caseExpr,"*").drop(col_tmp)  
        self.addTransformDescr(col,"Map values {}".format(json.dumps(valueMappings)))
        print("Values for {0} converted per supplied mapping".format(col))
        return df

    def addTransformDescr(self, col, transformDescr):
        self.transformDescr[col] = transformDescr


    # setColDataTypes:
    #   
    def setColDataTypes(self,df):
        self.transformDescr[col] = transformDescr
        for col,col_type in df.dtypes:
            if col in self.addl_variables:
                metadata = self.addl_variables[col]
            elif col in self.harmonized_variables:
                metadata = self.harmonized_variables[col]  
            else:
                continue
            uitype = metadata["type"]
            # boolean field should be type 'int'
            if uitype == "boolean" and col_type != "int":
                # cast column to 'int'
                print("Casting variable {0} from datatype {1} to 'int'".format(col, col_type))
                df = df.withColumn(col, df[col].cast("int"))
        return df

    # makeValidVariableNames:
    #   
    def makeValidVariableNames(self, df):
        for col in df.columns:
            newcol = re.sub('[ ,;{}()\n\t=/]', '', col)
            newcol = newcol.lower()
            if newcol != col:
                df = self.mapVar(df, col, newcol)
        return df        
    

    def get_unique_values(self, df, col):
        val_list = df.select(col).distinct().filter(df[col] != '').rdd.map(lambda r: r[0]).collect()
        val_list.sort()
        return val_list

    def buildDataDict(self,df):
        unionList=[]
        for col,col_type in df.dtypes:
            # assemble existing metadata for field
            metadata=None
            if col in self.addl_variables:
                metadata = self.addl_variables[col]
            elif col in self.harmonized_variables:
                metadata = self.harmonized_variables[col]
            mapping=None
            if col in self.varmapreverse:
                mapping = "Source %s. " % self.varmapreverse[col].replace("'", r"\'")
            else:
                mapping = ""
            if col in self.transformDescr:
                mapping += "%s" % self.transformDescr[col]
            else:
                mapping += "Variable value unchanged from source dataset."
            # build a sql query to get dict record for each field
            fieldexpr = "'%s' AS dict_field" % col
            countexpr = "COUNT(`%s`) AS dict_count" % col
            countdistinctexpr = "COUNT(DISTINCT `%s`) AS dict_countdistinct" % col
            nacountexpr = "SUM(CASE WHEN `%s` IS NULL THEN 1 ELSE 0 END) AS dict_countmissing" % col
            mappingexpr = "'%s' AS dict_varmapping" % mapping
            minexpr = "MIN(`%s`) AS dict_min" % col
            maxexpr = "MAX(`%s`) AS dict_max" % col               
            if not 'string' in col_type and not 'timestamp' in col_type:
                meanexpr= "AVG(`%s`) AS dict_mean" % col
                stdexpr = "STDDEV_POP(`%s`) AS dict_stddev" % col
            else:
                meanexpr= "NULL AS dict_mean"
                stdexpr = "NULL AS dict_stddev"
            if metadata:
                groupexpr = "'%s' AS dict_vargroup" % metadata["group"]
                typeexpr = "'%s' AS dict_vartype" % metadata["type"]
                descriptionexpr = "'%s' AS dict_vardescr" % metadata["descr"]
                uifilterexpr = "'%s' AS dict_uifilter" % metadata["uifilter"]
            else:
                groupexpr = "'%s' AS dict_vargroup" % self.defaultVargroup
                typeexpr = "'%s' AS dict_vartype" % "unknown"
                descriptionexpr = "'%s' AS dict_vardescr" % "unknown"
                uifilterexpr = "'%s' AS dict_uifilter" % "True"
            sql = '''
                SELECT %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s FROM tmptable
            ''' % (fieldexpr, countexpr, countdistinctexpr, nacountexpr, meanexpr, stdexpr, minexpr, maxexpr, groupexpr, typeexpr, descriptionexpr, uifilterexpr, mappingexpr)
            unionList.append(sql)

        # build union all query to include all fields
        unionSql = " UNION ALL ".join(unionList)
        df.registerTempTable('tmptable')
        df_dict = self.hc.sql(unionSql)

        # update fields with 'unknown' mappings to set best guess 'type' from data distribution
        # this allows fields to be used in the search UI with sensible input widgets
        df_dict = df_dict.withColumnRenamed("dict_vartype", "dict_vartype_orig")
        selectExpr = """
            CASE
                WHEN (dict_vartype_orig = 'unknown' AND dict_mean IS NULL)
                   THEN 'text'
                WHEN (dict_vartype_orig = 'unknown' AND dict_countdistinct=2 AND dict_min=0 AND dict_max=1)
                   THEN 'boolean'
                WHEN (dict_vartype_orig = 'unknown' AND dict_countdistinct > (1+ dict_max - dict_min))
                   THEN CONCAT('range,0,',floor(dict_max+1),',0.1')
                WHEN (dict_vartype_orig = 'unknown')
                   THEN CONCAT('range,0,',floor((dict_max/10)+1)*10,',1')
                ELSE dict_vartype_orig
            END AS dict_vartype
        """
        df_dict=df_dict.selectExpr("*",selectExpr).drop("dict_vartype_orig").coalesce(1)
        return df_dict

    def saveAsParquetTable(self,df,schema,table,s3path):
        print("Creating Spark SQL table: {0}.{1}".format(schema, table))
        tablepath="{0}/table={1}".format(s3path, table)
        df.write.saveAsTable("{0}.{1}".format(schema, table),
                         path=tablepath,
                         format='parquet',
                         mode='overwrite'
                        )
        # Generate table DDL in Athena compatable format 
        ddl=self.hc.sql("SHOW CREATE TABLE %s.%s" % (schema, table)).collect()[0]["createtab_stmt"]
        ddl = re.sub('CREATE TABLE', 'CREATE EXTERNAL TABLE', ddl)
        ddl = re.sub('USING', 'STORED AS', ddl)
        ddl = re.sub('OPTIONS (.*)', '', ddl, flags=re.DOTALL)  # remove OPTIONS clause to end of string
        ddl = ddl + "LOCATION '{0}/';".format(tablepath)
        return ddl

    def executeAthenaDDL(self, athena_s3_staging_dir, ddlList):
        if type(ddlList) is not list:
            ddlList = [ddlList]
        athena_url="jdbc:awsathena://athena.{0}.amazonaws.com:443".format(os.environ['AWS_DEFAULT_REGION'])
        conn = jaydebeapi.connect('com.amazonaws.athena.jdbc.AthenaDriver',
                                   athena_url,
                                   {
                                       "aws_credentials_provider_class":"com.amazonaws.auth.InstanceProfileCredentialsProvider",
                                       "s3_staging_dir":athena_s3_staging_dir,
                                       "log_path":"/tmp/athenajdbc.log",
                                       "log_level":"TRACE"
                                   },
                                   '/usr/lib/athena/AthenaJDBC41-1.1.0.jar')
        for ddl in ddlList:
            print("Exectuting Athena DDL: {0}".format(ddl))
            stmt = conn.jconn.createStatement()
            stmt.executeQuery(ddl)

    
    def publishNotebookToS3(self, outputdocpath, notebook_urlbase, notebookName):
        time.sleep(5) # give time for prior javascript save action to complete for both ipynb and html.
        for ext in ["ipynb", "html"]:
            src = notebookName + "." + ext
            dest = outputdocpath + "/" + src
            url = notebook_urlbase + "." + ext
            print("Copy %s to %s" % (src, dest))
            os.system("aws s3 cp %s %s --sse --grants read=uri=http://acs.amazonaws.com/groups/global/AllUsers" % (src, dest))
            print("URL: %s" % (url))
