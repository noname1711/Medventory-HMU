run SQL:
```bash
sudo -u postgres psql -c "CREATE DATABASE medventory_hmu;"
sudo -u postgres psql -d medventory_hmu -f init_database.sql
```
run be
```bash
mvn compile
mvn spring-boot:run
```
run fe and go to the website
```bash
npm run dev
```