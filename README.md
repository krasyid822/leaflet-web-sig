# Peta Kebisingan Interaktif (QGIS ke Leaflet)

Proyek ini adalah antarmuka web interaktif berbasis Leaflet untuk menampilkan data tingkat kebisingan (dalam dBA) yang telah diukur dan diekspor dari QGIS dalam format GeoJSON.

## Fitur Utama

- **Pemuatan Data Dinamis:** Memuat file GeoJSON berisi titik ukur maupun poligon batas area langsung dari antarmuka web.
- **Visualisasi Titik Ukur:** Menampilkan lokasi pasti pengukuran kebisingan beserta popup detailnya.
- **Heatmap Akurat Berbasis Nilai:** Menampilkan sebaran intensitas kebisingan menggunakan teknik *CSS Blur* yang memecahkan masalah umum pada heatmap kepadatan (*density-based*).
- **Representasi Area Kosong:** Sistem dirancang agar area yang tidak memiliki data titik ukur dibiarkan kosong, mencerminkan bahwa "belum dilakukan pengukuran" dan bukan "bernilai rendah/aman".

## Masalah pada Heatmap Standar

Jika menggunakan plugin heatmap web standar (seperti `leaflet.heat` atau plugin heatmap pada umumnya), algoritma yang sering digunakan adalah berdasarkan **kepadatan titik (density)**. 

Berdasarkan algoritma tersebut, jika terdapat banyak titik dengan nilai kebisingan **rendah (hijau)** yang lokasinya saling berdekatan atau bertumpuk, nilai kepadatannya akan terus ditambahkan satu sama lain. Akibatnya, pada titik batas tertentu, gabungan "kepadatan" titik hijau ini akan ditampilkan dengan warna **merah** seolah-olah itu adalah area yang sangat bising.

Hal ini **salah dan menyesatkan** dalam konteks pengukuran kebisingan, karena banyak titik bising rendah yang berdekatan tidak akan menjadikan area tersebut tiba-tiba menjadi area dengan kebisingan tingkat ekstrim.

## Solusi Heatmap Menggunakan CSS Blur Pane

Untuk memastikan visualisasi warna 100% akurat dengan nilai aktual data pengukuran, kami mengabaikan plugin *density-based* dan menggunakan pendekatan berikut di Leaflet:

1. **Pembuatan Custom Pane:** Membuat sebuah layer atau *pane* terpisah dan eksklusif di dalam peta Leaflet.
2. **Pewarnaan Marker Absolut:** Setiap data titik digambar sebagai `L.circleMarker` berukuran agak besar dengan warna solid yang sesuai dengan nilainya:
   - 🟩 **Hijau** (Rendah: < 65 dBA)
   - 🟧 **Kuning / Oranye** (Sedang: 65 - 75 dBA)
   - 🟥 **Merah** (Tinggi: > 75 dBA)
3. **Z-Index Berdasarkan Kebisingan (Sorting):** Sebelum dirender, seluruh titik diurutkan dari nilai terkecil ke terbesar. Hal ini dilakukan agar titik yang paling bising (merah) digambar paling akhir/paling atas, sehingga suaranya "mendominasi" area di sekitarnya dan tidak tertimbun oleh marker hijau.
4. **Efek CSS Blur Serentak:** Terakhir, *pane* khusus yang membungkus semua titik marker tersebut diberikan efek CSS `filter: blur(20px)`.

### Hasil yang Didapatkan
Dengan kombinasi teknik di atas, tepi dari setiap *circle marker* akan memudar dan membaur secara halus satu sama lain membentuk visualisasi yang sangat identik dengan heatmap. 

Yang paling penting: **Titik hijau yang saling bertumpuk ribuan kali pun hanya akan membentuk "awan hijau" yang lebih besar, tanpa pernah merubah warnanya menjadi merah.** Area merah dan oranye hanya akan muncul jika memang ada data aktual yang menyentuh angka kebisingan tersebut.

Dialihkan ke https://github.com/krasyid822/heatmap-peta-kebisingan
