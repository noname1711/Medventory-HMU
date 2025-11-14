package com.backend.repository;

import com.backend.entity.SuppForecastHeader;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SuppForecastHeaderRepository extends JpaRepository<SuppForecastHeader, Long> {
    List<SuppForecastHeader> findByStatusOrderByCreatedAtDesc(Integer status);
    List<SuppForecastHeader> findByStatusInOrderByCreatedAtDesc(List<Integer> statuses);
    Long countByStatus(Integer status);
}