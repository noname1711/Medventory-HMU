package com.backend.repository;

import com.backend.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByEntityType_CodeAndEntityIdOrderByCreatedAtDesc(String entityCode, Long entityId);
}
