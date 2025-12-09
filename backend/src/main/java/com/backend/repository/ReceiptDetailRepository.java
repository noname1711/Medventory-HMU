package com.backend.repository;

import com.backend.entity.ReceiptDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReceiptDetailRepository extends JpaRepository<ReceiptDetail, Long> {
    List<ReceiptDetail> findByHeaderId(Long headerId);
    List<ReceiptDetail> findByMaterialId(Long materialId);
}