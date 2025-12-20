package com.backend.repository;

import com.backend.entity.NotificationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NotificationEntityRepository extends JpaRepository<NotificationEntity, Long> {
    Optional<NotificationEntity> findByCode(String code);
}
