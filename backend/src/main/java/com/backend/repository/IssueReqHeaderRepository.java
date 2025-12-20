package com.backend.repository;

import com.backend.entity.IssueReqHeader;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface IssueReqHeaderRepository extends JpaRepository<IssueReqHeader, Long> {

    // ===== Theo status code =====
    List<IssueReqHeader> findByStatus_Code(String statusCode);

    List<IssueReqHeader> findByStatus_CodeOrderByRequestedAtDesc(String statusCode);

    List<IssueReqHeader> findByStatus_CodeInOrderByRequestedAtDesc(List<String> statusCodes);

    Long countByStatus_Code(String statusCode);

    // ===== Theo user / dept =====
    List<IssueReqHeader> findByCreatedById(Long userId);

    List<IssueReqHeader> findByCreatedByIdOrderByRequestedAtDesc(Long createdById);

    List<IssueReqHeader> findByDepartmentId(Long departmentId);

    List<IssueReqHeader> findByDepartmentIdAndStatus_Code(Long departmentId, String statusCode);

    // ===== Pending / Processed cho department =====
    @Query("""
        SELECT ir FROM IssueReqHeader ir
        WHERE ir.status.code = 'PENDING' AND ir.department.id = :departmentId
        ORDER BY ir.requestedAt DESC
    """)
    List<IssueReqHeader> findPendingByDepartmentId(@Param("departmentId") Long departmentId);

    @Query("""
        SELECT ir FROM IssueReqHeader ir
        WHERE ir.status.code <> 'PENDING' AND ir.department.id = :departmentId
        ORDER BY ir.approvalAt DESC
    """)
    List<IssueReqHeader> findProcessedByDepartmentId(@Param("departmentId") Long departmentId);

    // ===== Lịch sử phê duyệt =====
    @Query("SELECT ir FROM IssueReqHeader ir WHERE ir.approvalBy.id = :approverId ORDER BY ir.approvalAt DESC")
    List<IssueReqHeader> findByApproverId(@Param("approverId") Long approverId);

    long countByDepartmentIdAndStatus_Code(Long departmentId, String statusCode);

    long countByCreatedByIdAndStatus_Code(Long userId, String statusCode);

    // ===== Top latest =====
    IssueReqHeader findTopByDepartmentIdOrderByRequestedAtDesc(Long departmentId);

    IssueReqHeader findTopByDepartmentIdAndSubDepartmentIdOrderByRequestedAtDesc(Long departmentId, Long subDepartmentId);

    // ===== Pageable variants (giữ pattern như bạn đang dùng) =====
    List<IssueReqHeader> findByStatus_CodeOrderByRequestedAtAsc(String statusCode, Pageable pageable);

    List<IssueReqHeader> findByDepartmentIdAndStatus_CodeOrderByRequestedAtAsc(Long departmentId, String statusCode);

    List<IssueReqHeader> findByDepartmentIdAndStatus_CodeOrderByRequestedAtAsc(Long departmentId, String statusCode, Pageable pageable);

    List<IssueReqHeader> findByDepartmentIdAndSubDepartmentIdAndStatus_CodeOrderByRequestedAtAsc(Long departmentId, Long subDepartmentId, String statusCode);

    List<IssueReqHeader> findByDepartmentIdAndSubDepartmentIdAndStatus_CodeOrderByRequestedAtAsc(Long departmentId, Long subDepartmentId, String statusCode, Pageable pageable);

    // ===== Concurrency =====
    @Query(value = """
        SELECT * FROM issue_req_header
        WHERE id = :id
        FOR UPDATE
        """, nativeQuery = true)
    IssueReqHeader lockByIdForUpdate(@Param("id") Long id);
}
