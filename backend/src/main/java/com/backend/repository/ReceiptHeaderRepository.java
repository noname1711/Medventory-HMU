package com.backend.repository;

import com.backend.entity.ReceiptHeader;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import org.springframework.data.domain.Pageable;
import java.time.LocalDate;
import java.util.List;

public interface ReceiptHeaderRepository extends JpaRepository<ReceiptHeader, Long> {
    List<ReceiptHeader> findByReceiptDateOrderByIdDesc(LocalDate receiptDate);
    List<ReceiptHeader> findByIdLessThanOrderByIdDesc(Long beforeId, Pageable pageable);

    /** Tìm phiếu nhập theo mã / nhà cung cấp / lý do / ngày (lọc ở DB, có phân trang). */
    @Query("SELECT h FROM ReceiptHeader h WHERE "
            + "CAST(h.id AS string) LIKE CONCAT('%', :kw, '%') "
            + "OR LOWER(COALESCE(h.receivedFrom, '')) LIKE CONCAT('%', :kw, '%') "
            + "OR LOWER(COALESCE(h.reason, '')) LIKE CONCAT('%', :kw, '%')")
    Page<ReceiptHeader> searchByKeyword(@Param("kw") String kw, Pageable pageable);
}
