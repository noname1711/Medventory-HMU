package com.backend.repository;

import com.backend.entity.ReceiptHeader;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface ReceiptHeaderRepository extends JpaRepository<ReceiptHeader, Long> {
    List<ReceiptHeader> findByReceiptDateOrderByIdDesc(LocalDate receiptDate);
}
