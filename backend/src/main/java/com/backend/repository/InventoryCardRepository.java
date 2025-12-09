package com.backend.repository;

import com.backend.entity.InventoryCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InventoryCardRepository extends JpaRepository<InventoryCard, Long> {
    List<InventoryCard> findByMaterialId(Long materialId);
    List<InventoryCard> findByLotNumber(String lotNumber);
    List<InventoryCard> findByExpDateBefore(LocalDate date); // Vật tư sắp hết hạn

    @Query("SELECT i FROM InventoryCard i WHERE i.material.id = :materialId AND i.closingStock > 0")
    List<InventoryCard> findAvailableStockByMaterialId(@Param("materialId") Long materialId);

    @Query("SELECT COALESCE(SUM(i.closingStock), 0) FROM InventoryCard i WHERE i.material.id = :materialId")
    BigDecimal getTotalStockByMaterialId(@Param("materialId") Long materialId);

    Optional<InventoryCard> findByMaterialIdAndLotNumber(Long materialId, String lotNumber);

    @Query("SELECT i FROM InventoryCard i WHERE i.expDate BETWEEN :startDate AND :endDate")
    List<InventoryCard> findExpiringSoon(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
}