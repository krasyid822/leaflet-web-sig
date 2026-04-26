# Penanganan Area Belum Terjamah pada Peta Kebisingan
## (QGIS ke Leaflet Web)

Dokumen ini menjelaskan cara menangani dan menampilkan **area yang belum terjamah pengukuran kebisingan**, di mana **tidak terdapat titik koordinat dan tidak ada data kebisingan**, sehingga **tidak keliru diinterpretasikan sebagai area dengan kebisingan rendah**.

---

## Kondisi Data

- Seluruh data kebisingan yang ada:
  - Memiliki koordinat valid (latitude & longitude)
  - Memiliki nilai `noise_db` yang lengkap
- Area bermasalah:
  - **Tidak memiliki titik pengukuran sama sekali**
  - **Tidak ada data yang bisa dihitung atau diinterpolasi**

Dengan demikian, permasalahan **bukan nilai `NULL`**, melainkan **ketiadaan data spasial**.

---

## Prinsip Dasar (WAJIB)

> **Lokasi tanpa titik pengukuran tidak boleh diberi warna atau nilai apa pun.**

Artinya:
- Area kosong ≠ nilai rendah  
- Area kosong = **belum dilakukan pengukuran**
- GIS tidak boleh “menebak” nilai kebisingan

Pendekatan ini sesuai praktik ilmiah dalam GIS dan kajian lingkungan.

---

## Implementasi di QGIS

### Praktik yang Sudah Benar
- Layer titik hanya berisi lokasi yang benar-benar diukur
- Tidak ada titik fiktif atau data buatan
- Tidak ada atribut `noise_db` kosong

✅ **Struktur data tidak perlu diubah**

---

### Heatmap / Interpolasi di QGIS
Saat membuat:
- Heatmap
- IDW
- Kriging

QGIS akan:
- Menghitung hanya di sekitar titik yang ada
- Membiarkan area jauh dari titik tetap kosong

> **Area kosong pada peta = area belum terjamah pengukuran**

---

### Kesalahan yang Harus Dihindari
- Mengisi area kosong dengan nilai rendah
- Menambahkan titik palsu
- Menganggap “warna hijau = aman” tanpa data

---

## Implementasi di Leaflet Web

### Prinsip Visualisasi
Leaflet hanya menampilkan **data yang ada**.  
Area tanpa titik akan **tetap kosong secara alami**.

---

### Heatmap di Leaflet (Data Valid Saja)

```javascript
fetch('noise_measured.geojson')
  .then(res => res.json())
  .then(data => {
    let heatData = [];

    data.features.forEach(f => {
      heatData.push([
        f.geometry.coordinates[1], // latitude
        f.geometry.coordinates[0], // longitude
        f.properties.noise_db      // nilai kebisingan
      ]);
    });

    L.heatLayer(heatData, {
      radius: 30,
      blur: 20,
      minOpacity: 0.3
    }).addTo(map);
  });

### Legend yang Wajib Ditampilkan

🟥 Tinggi (> 75 dBA) – Diukur
🟧 Sedang (65–75 dBA) – Diukur
🟩 Rendah (< 65 dBA) – Diukur
⬜ Area kosong – Belum dilakukan pengukuran
