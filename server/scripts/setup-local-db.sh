#!/bin/bash
set -e

echo "Updating packages..."
apt-get update -qq

echo "Installing PostgreSQL..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib

echo "Starting PostgreSQL service..."
service postgresql start

echo "Configuring PostgreSQL user and database..."
su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD 'postgrespassword';\"" || true
su - postgres -c "createdb coding_lab_db" || true

echo "Configuring pg_hba.conf for md5 password authentication..."
PG_CONF_DIR=$(ls -d /etc/postgresql/*/*/ | head -n 1)
if [ -n "$PG_CONF_DIR" ]; then
  echo "listen_addresses = '*'" >> "${PG_CONF_DIR}postgresql.conf"
  sed -i 's/local   all             all                                     peer/local   all             all                                     md5/' "${PG_CONF_DIR}pg_hba.conf"
  sed -i 's/host    all             all             127.0.0.1\/32            md5/host    all             all             0.0.0.0\/0               md5/' "${PG_CONF_DIR}pg_hba.conf"
  service postgresql restart
fi

echo "PostgreSQL setup complete and running on port 5432!"
