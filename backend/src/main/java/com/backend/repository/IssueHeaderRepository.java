package com.backend.repository;

import com.backend.entity.IssueHeader;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;

public interface IssueHeaderRepository extends JpaRepository<IssueHeader, Long> {
    List<IssueHeader> findByCreatedByIdOrderByIssueDateDesc(Long createdById);
    List<IssueHeader> findByDepartmentIdOrderByIssueDateDesc(Long departmentId);
    List<IssueHeader> findByIssueDateBetween(LocalDate startDate, LocalDate endDate);
    List<IssueHeader> findByIssueReqId(Long issueReqId);

    @Query("SELECT i FROM IssueHeader i WHERE i.receiverName LIKE %:receiver%")
    List<IssueHeader> findByReceiverNameContaining(@Param("receiver") String receiver);
}