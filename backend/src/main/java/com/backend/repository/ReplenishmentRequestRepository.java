package com.backend.repository;

import com.backend.entity.ReplenishmentRequest;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReplenishmentRequestRepository extends JpaRepository<ReplenishmentRequest, Long> {
}
