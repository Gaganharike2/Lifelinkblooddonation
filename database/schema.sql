DROP DATABASE IF EXISTS lifelink_blood;
CREATE DATABASE lifelink_blood CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lifelink_blood;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  mobile VARCHAR(24) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('donor','patient','hospital','blood_bank','camp_organizer','ngo','volunteer','admin','super_admin') NOT NULL DEFAULT 'donor',
  blood_group VARCHAR(5),
  city VARCHAR(100),
  address VARCHAR(255),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  account_status ENUM('active','banned','deactivated') DEFAULT 'active',
  referral_code VARCHAR(24) UNIQUE,
  referred_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE otp_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  channel ENUM('email','mobile') NOT NULL DEFAULT 'email',
  code VARCHAR(12) NOT NULL,
  purpose ENUM('register','login','reset') NOT NULL DEFAULT 'register',
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE donor_profiles (
  user_id INT PRIMARY KEY,
  gender ENUM('male','female','other') NULL,
  date_of_birth DATE NULL,
  profile_image VARCHAR(255) NULL,
  last_donation_date DATE NULL,
  next_eligible_date DATE NULL,
  weight_kg DECIMAL(5,2),
  hemoglobin DECIMAL(4,1),
  blood_pressure VARCHAR(20),
  availability ENUM('available','busy','unavailable') DEFAULT 'available',
  emergency_opt_in TINYINT(1) DEFAULT 1,
  health_notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  medical_condition VARCHAR(180),
  preferred_hospital VARCHAR(160),
  emergency_contact VARCHAR(24),
  verification_status ENUM('pending','verified','rejected') DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE hospitals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  license_number VARCHAR(80),
  verification_status ENUM('pending','verified','rejected') DEFAULT 'pending',
  emergency_capacity INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE blood_banks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  license_number VARCHAR(80),
  storage_capacity_units INT DEFAULT 0,
  verification_status ENUM('pending','verified','rejected') DEFAULT 'pending',
  rare_group_monitoring TINYINT(1) DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE camp_organizers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  organization_name VARCHAR(160),
  verification_status ENUM('pending','verified','rejected') DEFAULT 'pending',
  premium_enabled TINYINT(1) DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE ngos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  registration_number VARCHAR(80),
  verification_status ENUM('pending','verified','rejected') DEFAULT 'pending',
  focus_city VARCHAR(100),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE volunteers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  skills VARCHAR(255),
  availability ENUM('available','busy','unavailable') DEFAULT 'available',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE staff_management (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL,
  staff_name VARCHAR(120) NOT NULL,
  email VARCHAR(160),
  mobile VARCHAR(24),
  role_title VARCHAR(80) NOT NULL,
  department VARCHAR(100),
  shift_name VARCHAR(60),
  status ENUM('active','inactive','on_leave') DEFAULT 'active',
  tasks_completed INT DEFAULT 0,
  last_active_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_staff_hospital_status (hospital_id, status)
);

CREATE TABLE hospital_profile (
  hospital_id INT PRIMARY KEY,
  hospital_name VARCHAR(160) NOT NULL,
  logo_path VARCHAR(255),
  cover_path VARCHAR(255),
  registration_number VARCHAR(100),
  license_number VARCHAR(100),
  gst_number VARCHAR(40),
  establishment_year INT,
  hospital_category VARCHAR(100),
  hospital_type VARCHAR(100),
  phone VARCHAR(30),
  whatsapp VARCHAR(30),
  emergency_helpline VARCHAR(30),
  website VARCHAR(180),
  country VARCHAR(80),
  state VARCHAR(100),
  city VARCHAR(100),
  pincode VARCHAR(20),
  full_address VARCHAR(255),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  monday_hours VARCHAR(80),
  tuesday_hours VARCHAR(80),
  wednesday_hours VARCHAR(80),
  thursday_hours VARCHAR(80),
  friday_hours VARCHAR(80),
  saturday_hours VARCHAR(80),
  sunday_hours VARCHAR(80),
  emergency_24x7 TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE hospital_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL,
  document_type VARCHAR(80) NOT NULL,
  file_name VARCHAR(180) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120),
  verification_status ENUM('pending','verified','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE hospital_settings (
  hospital_id INT PRIMARY KEY,
  emergency_24x7 TINYINT(1) DEFAULT 1,
  email_notifications TINYINT(1) DEFAULT 1,
  sms_notifications TINYINT(1) DEFAULT 1,
  two_factor_enabled TINYINT(1) DEFAULT 0,
  otp_channel ENUM('email','sms','both') DEFAULT 'both',
  language VARCHAR(12) DEFAULT 'en',
  dark_mode TINYINT(1) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE donor_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL,
  donor_id INT NOT NULL,
  blood_group VARCHAR(5) NOT NULL,
  message TEXT,
  status ENUM('pending','accepted','rejected','cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE hospital_branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL,
  branch_name VARCHAR(140) NOT NULL,
  branch_type VARCHAR(80),
  phone VARCHAR(30),
  city VARCHAR(100),
  address VARCHAR(255),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE support_tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL,
  subject VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
  status ENUM('open','in_progress','resolved','closed') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE hospital_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL,
  device_name VARCHAR(120),
  ip_address VARCHAR(80),
  user_agent VARCHAR(255),
  last_seen_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE rewards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  points INT NOT NULL DEFAULT 0,
  reason VARCHAR(180) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plan_name VARCHAR(80) NOT NULL,
  amount_paise INT NOT NULL,
  status ENUM('created','active','failed','cancelled') DEFAULT 'created',
  razorpay_order_id VARCHAR(120),
  razorpay_payment_id VARCHAR(120),
  payment_provider VARCHAR(40) DEFAULT 'razorpay',
  cashfree_order_id VARCHAR(120),
  cashfree_payment_id VARCHAR(120),
  starts_at DATETIME NULL,
  expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE subscription_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255),
  amount_paise INT NOT NULL DEFAULT 0,
  billing_cycle ENUM('monthly','yearly') DEFAULT 'monthly',
  donor_search_limit INT DEFAULT 0,
  emergency_request_limit INT DEFAULT 0,
  notification_limit INT DEFAULT 0,
  blood_request_limit INT DEFAULT 0,
  features JSON NULL,
  razorpay_plan_id VARCHAR(120),
  is_recommended TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE blood_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  blood_group VARCHAR(5) NOT NULL,
  units INT NOT NULL DEFAULT 0,
  expires_on DATE NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE blood_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  requester_id INT NOT NULL,
  patient_name VARCHAR(120) NOT NULL,
  blood_group VARCHAR(5) NOT NULL,
  units_needed INT NOT NULL DEFAULT 1,
  urgency ENUM('normal','urgent','critical') DEFAULT 'normal',
  hospital_name VARCHAR(160),
  city VARCHAR(100),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  contact_mobile VARCHAR(24),
  status ENUM('open','matched','fulfilled','cancelled') DEFAULT 'open',
  needed_by DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE emergency_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  requester_id INT NOT NULL,
  patient_name VARCHAR(120) NOT NULL,
  blood_group VARCHAR(5) NOT NULL,
  units_needed INT NOT NULL DEFAULT 1,
  hospital_name VARCHAR(160),
  city VARCHAR(100),
  priority_score INT DEFAULT 50,
  status ENUM('pending','approved','broadcasted','fulfilled','rejected') DEFAULT 'pending',
  contact_mobile VARCHAR(24),
  needed_by DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  organizer_id INT NOT NULL,
  request_id INT NULL,
  appointment_at DATETIME NOT NULL,
  status ENUM('scheduled','completed','cancelled') DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE SET NULL
);

CREATE TABLE campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ngo_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  city VARCHAR(100),
  campaign_date DATE NOT NULL,
  target_donors INT DEFAULT 50,
  registered_donors INT DEFAULT 0,
  status ENUM('planned','live','completed') DEFAULT 'planned',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ngo_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE blood_camps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organizer_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  venue VARCHAR(180),
  city VARCHAR(100),
  camp_date DATE NOT NULL,
  target_donors INT DEFAULT 50,
  registered_donors INT DEFAULT 0,
  status ENUM('planned','live','completed','cancelled') DEFAULT 'planned',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE camp_registration (
  id INT AUTO_INCREMENT PRIMARY KEY,
  camp_id INT NOT NULL,
  donor_id INT NOT NULL,
  qr_code VARCHAR(120),
  attended_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (camp_id) REFERENCES blood_camps(id) ON DELETE CASCADE,
  FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subscription_id INT NULL,
  amount_paise INT NOT NULL,
  provider VARCHAR(40) DEFAULT 'razorpay',
  provider_payment_id VARCHAR(120),
  status ENUM('created','paid','failed','refunded') DEFAULT 'created',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subscription_id INT NULL,
  razorpay_order_id VARCHAR(120),
  razorpay_payment_id VARCHAR(120),
  payment_provider VARCHAR(40) DEFAULT 'razorpay',
  cashfree_order_id VARCHAR(120),
  cashfree_payment_id VARCHAR(120),
  amount_paise INT NOT NULL,
  purpose ENUM('subscription','donation','camp_premium') DEFAULT 'subscription',
  status ENUM('created','paid','failed','refunded') DEFAULT 'created',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

CREATE TABLE payment_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NOT NULL,
  event_name VARCHAR(80) NOT NULL,
  event_payload JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

CREATE TABLE invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subscription_id INT NOT NULL,
  invoice_no VARCHAR(80) NOT NULL UNIQUE,
  amount_paise INT NOT NULL,
  tax_paise INT NOT NULL DEFAULT 0,
  status ENUM('draft','paid','failed','cancelled') DEFAULT 'paid',
  billing_details JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

CREATE TABLE billing_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  legal_name VARCHAR(160),
  gst_number VARCHAR(40),
  billing_email VARCHAR(160),
  billing_phone VARCHAR(30),
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE subscription_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subscription_id INT NOT NULL,
  donor_searches_used INT DEFAULT 0,
  emergency_requests_used INT DEFAULT 0,
  notifications_sent INT DEFAULT 0,
  blood_requests_used INT DEFAULT 0,
  period_start DATE,
  period_end DATE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_usage_subscription (subscription_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

CREATE TABLE payment_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  subscription_id INT NULL,
  payment_id INT NULL,
  event_name VARCHAR(100) NOT NULL,
  event_payload JSON NULL,
  status VARCHAR(40) DEFAULT 'recorded',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payment_logs_user (user_id, created_at)
);

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info','success','warning','danger') DEFAULT 'info',
  read_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE donor_message_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL,
  donor_id INT NOT NULL,
  blood_group VARCHAR(5),
  subject VARCHAR(180),
  message TEXT NOT NULL,
  channels VARCHAR(80) NOT NULL,
  delivery_status JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_donor_message_logs_hospital (hospital_id, created_at),
  INDEX idx_donor_message_logs_donor (donor_id, created_at),
  FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE analytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  dimension_key VARCHAR(80),
  dimension_value VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_analytics_metric (metric_name, created_at)
);

CREATE TABLE chats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room VARCHAR(80) NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chats_room (room, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE health_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  file_name VARCHAR(180) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE health_tracker (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  weight_kg DECIMAL(5,2),
  hemoglobin DECIMAL(4,1),
  blood_pressure VARCHAR(20),
  pulse_rate INT,
  eligibility_status ENUM('eligible','review','not_eligible') DEFAULT 'review',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE medical_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  request_id INT NULL,
  file_name VARCHAR(180) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  report_type VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE SET NULL
);

CREATE TABLE blood_expiry (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inventory_id INT NOT NULL,
  alert_date DATE NOT NULL,
  status ENUM('open','resolved','discarded') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_id) REFERENCES blood_inventory(id) ON DELETE CASCADE
);

CREATE TABLE donations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  appointment_id INT NULL,
  blood_group VARCHAR(5),
  units INT DEFAULT 1,
  donation_date DATE NOT NULL,
  certificate_code VARCHAR(80),
  verified_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE referrals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  referrer_id INT NOT NULL,
  referred_user_id INT NOT NULL,
  reward_points INT DEFAULT 250,
  status ENUM('pending','rewarded') DEFAULT 'rewarded',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE chat_system (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room VARCHAR(80) NOT NULL,
  sender_id INT NOT NULL,
  receiver_id INT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE otp_verification (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  channel ENUM('email','mobile') DEFAULT 'email',
  otp_code VARCHAR(12) NOT NULL,
  purpose ENUM('register','login','reset') DEFAULT 'register',
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE admin_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80),
  entity_id INT NULL,
  ip_address VARCHAR(60),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  rating INT DEFAULT 5,
  message TEXT NOT NULL,
  status ENUM('new','reviewed','closed') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  subject VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  priority ENUM('low','medium','high') DEFAULT 'medium',
  status ENUM('open','investigating','resolved','closed') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_users_role_city_blood ON users(role, city, blood_group);
CREATE INDEX idx_requests_status_blood_city ON blood_requests(status, blood_group, city);
CREATE INDEX idx_inventory_owner_group ON blood_inventory(owner_id, blood_group);
CREATE INDEX idx_emergency_status_priority ON emergency_requests(status, priority_score);
CREATE INDEX idx_camps_city_date ON blood_camps(city, camp_date);
