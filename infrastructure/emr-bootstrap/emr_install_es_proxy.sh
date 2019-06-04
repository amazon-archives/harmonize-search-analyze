#!/bin/env bash

##########################################################################
#
#  Install, configure and run the aws-es-kibana proxy on EC2 instances
#
#  Installs node.js, npm and pm2 if not present
#
#  Uses the ELASTICSEARCH_ENDPOINT environmental variable as the proxy
#  target.
#
#  aws-es-kibana:
#    https://github.com/santthosh/aws-es-kibana
#
##########################################################################

umask 022
IFS=$'\n\t'
set -u # prevent undefined variables

# /sbin is needed for pm2 (chkconfig)
export PATH="${PATH}:/sbin"

function usage() {
  echo "Usage: $0 [-e <es_endpoint>] [-h]" >&2
  [ ${OPTS['HELP']:=''} ] && cat <<'EOF' >&2
  Install, configure and run the aws-es-kibana proxy on EC2 instances

  Installs node.js, npm and pm2 if not present

  Uses the ELASTICSEARCH_ENDPOINT environmental variable as the proxy
  target. The -e option overrides this variable.

  aws-es-kibana:
    https://github.com/santthosh/aws-es-kibana

  Options:
    -e <es_endpoint>
      Point the proxy to this Elasticsearch endpoint
      Takes precedence over the ELASTICSEARCH_ENDPOINT variable
    -h
      Displays help and exit
EOF
  exit 1
}

# Global associative array to populate options. Made readonly after getopts
declare -xgA OPTS

# elasticsearch endoint
OPTS['ENDPOINT']=''

# Display full help on usage. Boolean if set to non-emnpty
OPTS['HELP']=''

function get_arguments() {
  local OPTARG

  while getopts ':e:h' opt ; do
    case "${opt}" in
      e)
        OPTS['ENDPOINT']="${OPTARG}"
        ;;
      h)
        OPTS['HELP']=true
        usage ;;
      \?)
        echo "[ERROR] unknown option: ${OPTARG}" >&2
        usage
        ;;
      :)
        echo "[ERROR] option requires an argument: ${OPTARG}" >&2
        usage
        ;;
      *)
        echo "[ERROR] unimplemented option: ${OPTARG}" >&2
        usage
        ;;
    esac
  done
}

get_arguments "$@"

# set endpoint from environment if -e option not used
if [[ -z ${OPTS['ENDPOINT']:=''} && ! -z ${ELASTICSEARCH_ENDPOINT:=''} ]] ; then

  OPTS['ENDPOINT']="$ELASTICSEARCH_ENDPOINT"
fi

# abort if endpoint can't be determined
if [ -z ${OPTS['ENDPOINT']:=''} ] ; then
  echo '[ERROR] must provide endpoint via -e option or ELASTICSEARCH_ENDPOINT variable' >&2
  OPTS['HELP']=true
  usage
fi

# OPTS associative array set to readonly from here
readonly -a OPTS

function install_es_proxy() {
  local endpoint="$1"
  if [ -z "$endpoint" ] ; then
    echo "$0 - [ERROR] endpoint not defined" >&2
    exit 1
  fi

  # install node.js
  yum install -y gcc-c++ make
  curl -sL https://rpm.nodesource.com/setup_10.x | sudo -E bash -
  [ -f /usr/bin/node ] || yum -y install nodejs || {
    echo "$0 - [ERROR] failed to node.js" >&2
    exit 1
  }
  # validate that the node executable is installed
  [ -f /usr/bin/node ] || {
    echo "$0 - [ERROR] node executable file not found" >&2
    exit 1
  }

  # configure npm to use http (rather than https) to avoid intermittent hangs 
  # seen during package installations (https://github.com/npm/npm/issues/7862)
  npm config set registry http://registry.npmjs.org
  npm config set strict-ssl false

  # install aws-es-kibana
  [ -f /usr/bin/aws-es-kibana ] || npm install "aws-es-kibana" -g --verbose || {
    echo "$0 - [ERROR] failed to npm install aws-es-kibana" >&2
    exit 1
  }
  # validate that the aws-es-kibana script was installed
  [ -f /usr/bin/aws-es-kibana ] || {
    echo "$0 - [ERROR] aws-es-kibana executable file not found" >&2
    exit 1
  }

  # npm install pm2 to manage process
  [ -f /usr/bin/pm2 ] || npm install pm2 -g || {
    echo "$0 - [ERROR] failed to npm install pm2" >&2
    exit 1
  }
  # validate that the pm2 script was installed
  [ -f /usr/bin/pm2 ] || {
    echo "$0 - [ERROR] pm2 executable file not found" >&2
    exit 1
  }

  # if the proxy is running delete it
  su -c "pm2 show aws-es-kibana" - ec2-user && (su -c "pm2 delete aws-es-kibana" - ec2-user || {
    echo "$0 - [ERROR] could not delete running aws-es-kibana proxy" >&2
    exit 1
  })

  # create dummy credentials file (watched by proxy, although we're using cluster role credentials)
  [ -f ~ec2-user/.aws/credentials ] || {
    su -c "mkdir -p ~ec2-user/.aws && touch ~ec2-user/.aws/credentials" - ec2-user
  }

  # start proxy
  su -c "pm2 start /usr/bin/aws-es-kibana -- -s -b 127.0.0.1 $endpoint" - ec2-user || {
    echo "$0 - [ERROR] pm2 could not start aws-es-kibana" >&2
    exit 1
  }

  # save pm2
  su -c "pm2 save" - ec2-user || {
    echo "$0 - [ERROR] failed to save pm2 config" >&2
    exit 1
  }

  # create pm2 startup
  pm2 startup amazon -u ec2-user --hp /home/ec2-user || {
    echo "$0 - [ERROR] failed to config pm2 startup" >&2
    exit 1
  }

}

# get function into variable so that it can be executed by sudo
FUNC=$(declare -f install_es_proxy)

# install using sudo (needed for EMR bootstrap which runs as hadoop user)
sudo sh -x -c "$FUNC ; install_es_proxy ${OPTS['ENDPOINT']}" || exit $?

exit $?
