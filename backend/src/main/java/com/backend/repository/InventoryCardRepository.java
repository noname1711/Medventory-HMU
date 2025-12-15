package com.backend.repository;

import com.backend.entity.InventoryCard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InventoryCardRepository extends JpaRepository<InventoryCard, Long> {

    // Lấy thẻ kho gần nhất theo (material, lot) để lấy closing_stock làm opening_stock
    Optional<InventoryCard> findTopByMaterialIdAndLotNumberOrderByRecordDateDescIdDesc(Long materialId, String lotNumber);
}
