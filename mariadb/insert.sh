#!/bin/bash
# Quick insert script for Docker

mariadb -u root -proot innomcp <<EOF
DELETE FROM user WHERE username IN ('admin', 'user');

INSERT INTO user (username, user_pwd, user_email, user_dispname, user_active, userrole_id, user_disp_name, user_role_id) 
VALUES 
('admin', '\$2b\$10\$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGqeePe7JOHCU9yDC/.jN2m', 'admin@innomcp.local', 'System Administrator', '1', 0, 'System Administrator', 0),
('user', '\$2b\$10\$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGqeePe7JOHCU9yDC/.jN2m', 'user@innomcp.local', 'Regular User', '1', 1, 'Regular User', 1);

SELECT user_id, username, user_email, userrole_id, user_active FROM user WHERE username IN ('admin', 'user');
EOF
