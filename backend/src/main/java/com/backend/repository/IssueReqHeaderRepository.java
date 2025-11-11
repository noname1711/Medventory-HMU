package com.backend.repository;

import com.backend.entity.IssueReqHeader;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

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

    // Thêm các method này
    List<IssueReqHeader> findByStatusOrderByRequestedAtDesc(Integer status);
    List<IssueReqHeader> findByStatusInOrderByRequestedAtDesc(List<Integer> statuses);
    Long countByStatus(Integer status);
}