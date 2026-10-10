SELECT 'CREATE DATABASE ecommerce_auth'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ecommerce_auth')\gexec

SELECT 'CREATE DATABASE ecommerce_products'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ecommerce_products')\gexec

SELECT 'CREATE DATABASE ecommerce_orders'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ecommerce_orders')\gexec
