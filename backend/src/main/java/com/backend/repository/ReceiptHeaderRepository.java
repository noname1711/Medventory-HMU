package com.backend.repository;

import com.backend.entity.ReceiptHeader;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;

public interface ReceiptHeaderRepository extends JpaRepository<ReceiptHeader, Long> {
    List<ReceiptHeader> findByCreatedByIdOrderByReceiptDateDesc(Long createdById);
    List<ReceiptHeader> findByReceiptDateBetween(LocalDate startDate, LocalDate endDate);

    @Query("SELECT r FROM ReceiptHeader r WHERE r.receivedFrom LIKE %:supplier%")
    List<ReceiptHeader> findBySupplierContaining(@Param("supplier") String supplier);
}