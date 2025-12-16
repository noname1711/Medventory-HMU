package com.backend.repository;

import com.backend.entity.IssueDetail;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IssueDetailRepository extends JpaRepository<IssueDetail, Long> {
    List<IssueDetail> findByHeaderId(Long headerId);
}
