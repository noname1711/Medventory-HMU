package com.backend.repository;

import com.backend.entity.IssueReqDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IssueReqDetailRepository extends JpaRepository<IssueReqDetail, Long> {
    List<IssueReqDetail> findByHeaderId(Long headerId);
    void deleteByHeaderId(Long headerId);
}