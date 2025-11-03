package com.backend.repository;

import com.backend.entity.SuppForecastHeader;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SuppForecastHeaderRepository extends JpaRepository<SuppForecastHeader, Long> {
}
