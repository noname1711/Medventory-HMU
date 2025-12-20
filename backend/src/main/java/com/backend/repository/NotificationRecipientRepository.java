package com.backend.repository;

import com.backend.entity.NotificationRecipient;
import com.backend.entity.NotificationRecipient.NotificationRecipientId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NotificationRecipientRepository extends JpaRepository<NotificationRecipient, NotificationRecipientId> {

    Page<NotificationRecipient> findByUser_IdOrderByNotification_CreatedAtDesc(Long userId, Pageable pageable);

    Page<NotificationRecipient> findByUser_IdAndIsReadFalseOrderByNotification_CreatedAtDesc(Long userId, Pageable pageable);

    long countByUser_IdAndIsReadFalse(Long userId);

    Optional<NotificationRecipient> findByNotification_IdAndUser_Id(Long notificationId, Long userId);
}
