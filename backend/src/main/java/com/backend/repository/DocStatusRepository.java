package com.backend.repository;

import com.backend.entity.DocStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DocStatusRepository extends JpaRepository<DocStatus, Long> {
    Optional<DocStatus> findByCode(String code);
}
