package com.backend.repository;

import com.backend.entity.IssueHeader;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Optional;

public interface IssueHeaderRepository extends JpaRepository<IssueHeader, Long> {

    @Query(value = "SELECT COUNT(1) > 0 FROM issue_header WHERE receiver_name ILIKE CONCAT('%', :marker, '%')",
            nativeQuery = true)
    boolean existsByReceiverMarker(@Param("marker") String marker);

    Optional<IssueHeader> findByIssueReqId(Long issueReqId);

    List<IssueHeader> findByIdLessThanOrderByIdDesc(Long beforeId, Pageable pageable);

    /** Tìm phiếu xuất theo mã / người nhận / khoa / ngày (lọc ở DB, có phân trang). */
    @Query("SELECT h FROM IssueHeader h LEFT JOIN h.department d WHERE "
            + "CAST(h.id AS string) LIKE CONCAT('%', :kw, '%') "
            + "OR LOWER(COALESCE(h.receiverName, '')) LIKE CONCAT('%', :kw, '%') "
            + "OR LOWER(COALESCE(d.name, '')) LIKE CONCAT('%', :kw, '%')")
    Page<IssueHeader> searchByKeyword(@Param("kw") String kw, Pageable pageable);
}
