package com.backend.repository;

import com.backend.entity.IssueReqHeader;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import org.springframework.data.domain.Pageable;

public interface IssueReqHeaderRepository extends JpaRepository<IssueReqHeader, Long> {

    // Lấy phiếu theo trạng thái
    List<IssueReqHeader> findByStatus(Integer status);

    // Lấy phiếu của một user cụ thể
    List<IssueReqHeader> findByCreatedById(Long userId);

    // Lấy phiếu theo department
    List<IssueReqHeader> findByDepartmentId(Long departmentId);

    // Lấy phiếu chờ phê duyệt cho department
    @Query("SELECT ir FROM IssueReqHeader ir WHERE ir.status = 0 AND ir.department.id = :departmentId ORDER BY ir.requestedAt DESC")
    List<IssueReqHeader> findPendingByDepartmentId(@Param("departmentId") Long departmentId);

    // Lấy phiếu đã xử lý cho department
    @Query("SELECT ir FROM IssueReqHeader ir WHERE ir.status != 0 AND ir.department.id = :departmentId ORDER BY ir.approvalAt DESC")
    List<IssueReqHeader> findProcessedByDepartmentId(@Param("departmentId") Long departmentId);

    // Lấy phiếu theo department và status
    List<IssueReqHeader> findByDepartmentIdAndStatus(Long departmentId, Integer status);

    // Lấy lịch sử phê duyệt của lãnh đạo
    @Query("SELECT ir FROM IssueReqHeader ir WHERE ir.approvalBy.id = :approverId ORDER BY ir.approvalAt DESC")
    List<IssueReqHeader> findByApproverId(@Param("approverId") Long approverId);

    // Đếm phiếu theo trạng thái và department
    long countByDepartmentIdAndStatus(Long departmentId, Integer status);

    // Đếm phiếu của user theo trạng thái
    long countByCreatedByIdAndStatus(Long userId, Integer status);

    List<IssueReqHeader> findByStatusOrderByRequestedAtDesc(Integer status);
    List<IssueReqHeader> findByStatusInOrderByRequestedAtDesc(List<Integer> statuses);
    Long countByStatus(Integer status);

    List<IssueReqHeader> findByCreatedByIdOrderByRequestedAtDesc(Long createdById);

    List<IssueReqHeader> findByStatusOrderByRequestedAtAsc(Integer status);

    IssueReqHeader findTopByDepartmentIdOrderByRequestedAtDesc(Long departmentId);
    IssueReqHeader findTopByDepartmentIdAndSubDepartmentIdOrderByRequestedAtDesc(Long departmentId, Long subDepartmentId);

    List<IssueReqHeader> findByStatusOrderByRequestedAtAsc(Integer status, Pageable pageable);

    List<IssueReqHeader> findByDepartmentIdAndStatusOrderByRequestedAtAsc(Long departmentId, Integer status);
    List<IssueReqHeader> findByDepartmentIdAndStatusOrderByRequestedAtAsc(Long departmentId, Integer status, Pageable pageable);

    List<IssueReqHeader> findByDepartmentIdAndSubDepartmentIdAndStatusOrderByRequestedAtAsc(Long departmentId, Long subDepartmentId, Integer status);
    List<IssueReqHeader> findByDepartmentIdAndSubDepartmentIdAndStatusOrderByRequestedAtAsc(Long departmentId, Long subDepartmentId, Integer status, Pageable pageable);

    @Query(value = """
        SELECT * FROM issue_req_header
        WHERE id = :id
        FOR UPDATE
        """, nativeQuery = true)
    IssueReqHeader lockByIdForUpdate(@Param("id") Long id);
}