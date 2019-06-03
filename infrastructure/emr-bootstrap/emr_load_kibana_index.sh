#!/bin/env bash

##########################################################################
#
#  Install .kibana-4 index dump, containing index defaults, visualizations
#  and dashboard definition.
#
##########################################################################

ES_ENDPOINT=$1

      
if grep isMaster /mnt/var/lib/info/instance.json | grep true;
then

	# Install elasticdump
	sudo npm install -g elasticdump && sudo npm install -g n && sudo n stable

	# Load the index data
	/usr/bin/n use stable /usr/bin/elasticdump \
	   --input=/home/hadoop/datasearch-blog/kibana-content/kibana-exported-visualizations.json \
	   --output=http://${ES_ENDPOINT}/.kibana \
	   --type=data \
	   --awsChain

else
    echo "Slave node - skip elasticdump / kibana index installation"
fi

exit $?
