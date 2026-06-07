CREATE TABLE IF NOT EXISTS mz_phone_numbers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    citizenid VARCHAR(64) NOT NULL,
    phone_number VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_mz_phone_numbers_citizenid (citizenid),
    UNIQUE KEY uq_mz_phone_numbers_number (phone_number)
);

CREATE TABLE IF NOT EXISTS mz_phone_contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_citizenid VARCHAR(64) NOT NULL,
    contact_name VARCHAR(100) NOT NULL,
    contact_phone VARCHAR(32) NOT NULL,
    avatar TEXT NULL,
    favorite TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_mz_phone_contacts_owner (owner_citizenid)
);

CREATE TABLE IF NOT EXISTS mz_phone_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_citizenid VARCHAR(64) NOT NULL,
    target_number VARCHAR(32) NOT NULL,
    target_name VARCHAR(100) DEFAULT NULL,
    unread_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_mz_phone_conversation_target (owner_citizenid, target_number),
    INDEX idx_mz_phone_conversations_owner (owner_citizenid)
);

CREATE TABLE IF NOT EXISTS mz_phone_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    owner_citizenid VARCHAR(64) NOT NULL,
    sender VARCHAR(20) NOT NULL DEFAULT 'me',
    message TEXT NULL,
    message_type VARCHAR(30) NOT NULL DEFAULT 'text',
    media_url TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mz_phone_messages_conversation (conversation_id),
    INDEX idx_mz_phone_messages_owner (owner_citizenid)
);

CREATE TABLE IF NOT EXISTS mz_phone_calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_citizenid VARCHAR(64) NOT NULL,
    caller_citizenid VARCHAR(64) NULL,
    receiver_citizenid VARCHAR(64) NULL,
    caller_number VARCHAR(32) NULL,
    receiver_number VARCHAR(32) NULL,
    number VARCHAR(32) DEFAULT NULL,
    contact_id INT DEFAULT NULL,
    direction VARCHAR(20) DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ended',
    started_at TIMESTAMP NULL,
    answered_at TIMESTAMP NULL,
    ended_at TIMESTAMP NULL,
    duration INT NOT NULL DEFAULT 0,
    timestamp BIGINT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mz_phone_calls_owner (owner_citizenid),
    INDEX idx_mz_phone_calls_caller (caller_citizenid),
    INDEX idx_mz_phone_calls_receiver (receiver_citizenid),
    INDEX idx_mz_phone_calls_status (status)
);

CREATE TABLE IF NOT EXISTS mz_phone_gallery (
    id INT AUTO_INCREMENT PRIMARY KEY,
    citizenid VARCHAR(64) NOT NULL,
    url TEXT NOT NULL,
    caption VARCHAR(160) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mz_phone_gallery_citizenid (citizenid)
);

CREATE TABLE IF NOT EXISTS mz_phone_apps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    citizenid VARCHAR(64) NOT NULL,
    app_id VARCHAR(64) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    settings JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_mz_phone_apps_citizenid_app (citizenid, app_id)
);

CREATE TABLE IF NOT EXISTS mz_phone_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    citizenid VARCHAR(64) NOT NULL,
    theme VARCHAR(32) NOT NULL DEFAULT 'dark',
    wallpaper VARCHAR(120) NOT NULL DEFAULT 'default',
    ringtone VARCHAR(80) NOT NULL DEFAULT 'default',
    profile_photo TEXT NULL,
    settings JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_mz_phone_settings_citizenid (citizenid)
);

CREATE TABLE IF NOT EXISTS mz_phone_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    citizenid VARCHAR(64) NOT NULL,
    app_id VARCHAR(64) DEFAULT NULL,
    title VARCHAR(120) DEFAULT NULL,
    message VARCHAR(500) DEFAULT NULL,
    data JSON NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mz_phone_notifications_citizenid (citizenid)
);
