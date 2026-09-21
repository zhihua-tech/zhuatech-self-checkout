-- 上海如静知华信息科技有限公司 https://www.zhuatech.cn/
-- 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
CREATE DATABASE IF NOT EXISTS zhuatech_self_checkout DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE zhuatech_self_checkout;
CREATE TABLE retail_store(id VARCHAR(32) PRIMARY KEY,code VARCHAR(64) UNIQUE,name VARCHAR(128),address VARCHAR(255),currency VARCHAR(8),tax_rate DECIMAL(8,4),status VARCHAR(24),created_at DATETIME(3));
CREATE TABLE checkout_terminal(id VARCHAR(32) PRIMARY KEY,store_id VARCHAR(32),code VARCHAR(64) UNIQUE,model VARCHAR(64),status VARCHAR(24),lane_status VARCHAR(24),app_version VARCHAR(32),token_hash VARCHAR(128),last_heartbeat_at DATETIME(3),created_at DATETIME(3));
CREATE TABLE product(id VARCHAR(32) PRIMARY KEY,sku VARCHAR(64) UNIQUE,barcode VARCHAR(64) UNIQUE,name VARCHAR(128),price DECIMAL(12,2),unit_weight_grams INT,age_restricted TINYINT,status VARCHAR(24),created_at DATETIME(3));
CREATE TABLE store_stock(id VARCHAR(32) PRIMARY KEY,store_id VARCHAR(32),product_id VARCHAR(32),quantity INT,reserved INT,updated_at DATETIME(3),UNIQUE KEY uk_store_product(store_id,product_id));
CREATE TABLE checkout_basket(id VARCHAR(32) PRIMARY KEY,terminal_id VARCHAR(32),store_id VARCHAR(32),member_id VARCHAR(64),lines JSON,subtotal DECIMAL(12,2),discount DECIMAL(12,2),payable DECIMAL(12,2),status VARCHAR(24),created_at DATETIME(3),paid_at DATETIME(3));
CREATE TABLE loss_prevention_exception(id VARCHAR(32) PRIMARY KEY,basket_id VARCHAR(32),terminal_id VARCHAR(32),line_id VARCHAR(32),exception_type VARCHAR(32),message VARCHAR(512),status VARCHAR(24),resolution VARCHAR(512),resolved_by VARCHAR(64),created_at DATETIME(3),resolved_at DATETIME(3));
CREATE TABLE checkout_payment(id VARCHAR(32) PRIMARY KEY,basket_id VARCHAR(32),channel VARCHAR(24),trade_no VARCHAR(128) UNIQUE,amount DECIMAL(12,2),status VARCHAR(24),receipt_id VARCHAR(32),paid_at DATETIME(3));
CREATE TABLE electronic_receipt(id VARCHAR(32) PRIMARY KEY,receipt_no VARCHAR(64) UNIQUE,basket_id VARCHAR(32),payment_id VARCHAR(32),store_id VARCHAR(32),lines JSON,subtotal DECIMAL(12,2),discount DECIMAL(12,2),payable DECIMAL(12,2),issued_at DATETIME(3));
CREATE TABLE audit_event(id VARCHAR(32) PRIMARY KEY,actor VARCHAR(64),action VARCHAR(64),resource_id VARCHAR(64),detail JSON,occurred_at DATETIME(3));
