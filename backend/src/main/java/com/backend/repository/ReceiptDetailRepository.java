package com.backend.repository;

import com.backend.entity.ReceiptDetail;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReceiptDetailRepository extends JpaRepository<ReceiptDetail, Long> {
    List<ReceiptDetail> findByHeaderId(Long headerId);

    @Query("SELECT rd FROM ReceiptDetail rd WHERE rd.material.id = :materialId ORDER BY rd.header.receiptDate DESC, rd.id DESC")
    List<ReceiptDetail> findLatestByMaterialId(@Param("materialId") Long materialId, Pageable pageable);
}
