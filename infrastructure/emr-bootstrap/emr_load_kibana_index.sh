#!/bin/env bash

##########################################################################
#
#  Install .kibana-4 index dump, containing index defaults, visualizations
#  and dashboard definition.
#
##########################################################################

if grep isMaster /mnt/var/lib/info/instance.json | grep true;
then

	# Install elasticdump
	sudo npm install -g elasticdump && sudo npm install -g n && sudo n stable

	# Load the index data
	/usr/bin/n use stable /usr/bin/elasticdump \
	   --input=/home/hadoop/datasearch-blog/kibana-content/kibana-exported-visualizations.json \
	   --output=http://localhost:9200/.kibana \
	   --type=data

else
    echo "Slave node - skip elasticdump / kibana index installation"
fi

exit $?
