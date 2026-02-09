<?php
// Skru på absolutt alle feilmeldinger
ini_set('display_errors', 1);
error_reporting(E_ALL);

echo "<h1>Starter koblingstest...</h1>";

// --- DINE DETALJER ---
// I Supabase Dashboard: Gå til Settings -> Database -> Connection string -> URI
// Verten ser ofte slik ut: db.abcdefghijklm.supabase.co
$host = 'db.DIN-PROSJEKT-ID-HER.supabase.co'; 
$db   = 'postgres';      // Standard i Supabase
$user = 'postgres';      // Standard superbruker
$pass = 'DITT_PASSORD';  // Passordet du valgte da du opprettet prosjektet
$port = "5432";

try {
    // Prøver å opprette "broen"
    $dsn = "pgsql:host=$host;port=$port;dbname=$db";
    $conn = new PDO($dsn, $user, $pass);
    
    // Hvis vi kommer hit, er broen oppe!
    echo "<h2 style='color:green'>SUKSESS: Vi er inne!</h2>";
    echo "Koblingen til Supabase fungerer.";
    
    // Test: Prøv å hente tabellene dine for å bevise at vi ser data
    $stmt = $conn->query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    $tabeller = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    echo "<h3>Tabeller funnet i din database:</h3>";
    echo "<ul>";
    if (empty($tabeller)) {
        echo "<li style='color:red'>Ingen tabeller funnet! Har du laget 'users' tabellen i Public schema?</li>";
    } else {
        foreach ($tabeller as $tabell) {
            echo "<li>$tabell</li>";
        }
    }
    echo "</ul>";

} catch (PDOException $e) {
    // Her lander vi hvis broen er brutt
    echo "<h2 style='color:red'>FEIL: Klarte ikke koble til.</h2>";
    echo "<strong>Grunn:</strong> " . $e->getMessage() . "<br><br>";
    
    if (strpos($e->getMessage(), 'could not find driver') !== false) {
        echo "<strong>LØSNING:</strong> Serveren din mangler PHP-driveren for PostgreSQL. <br>";
        echo "Hvis du bruker XAMPP/MAMP: Åpne php.ini og fjern semikolon foran <code>extension=pgsql</code> og <code>extension=pdo_pgsql</code>.";
    }
}
?>