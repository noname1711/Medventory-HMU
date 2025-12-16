package com.backend.repository;

import com.backend.entity.IssueHeader;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface IssueHeaderRepository extends JpaRepository<IssueHeader, Long> {

    @Query(value = "SELECT COUNT(1) > 0 FROM issue_header WHERE receiver_name ILIKE CONCAT('%', :marker, '%')",
            nativeQuery = true)
    boolean existsByReceiverMarker(@Param("marker") String marker);
}
