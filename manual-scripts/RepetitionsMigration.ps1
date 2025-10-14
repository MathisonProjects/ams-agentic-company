# RepetitionsMigration.ps1
# Simple PowerShell script to add repetitions column to agent_recordings table

param(
    [string]$ContainerName = "ams-agentic-company-postgres",
    [string]$DatabaseName = "ams_agentic_company",
    [string]$Username = "postgres"
)

Write-Host "=== Adding repetitions column to agent_recordings ===" -ForegroundColor Green
Write-Host "Container: $ContainerName" -ForegroundColor Cyan
Write-Host "Database: $DatabaseName" -ForegroundColor Cyan
Write-Host "Username: $Username" -ForegroundColor Cyan
Write-Host ""

# Simple migration command
$migrationSQL = "ALTER TABLE agent_recordings ADD COLUMN IF NOT EXISTS repetitions INTEGER DEFAULT 1;"

Write-Host "Executing migration..." -ForegroundColor Yellow
Write-Host "SQL: $migrationSQL" -ForegroundColor Gray

# Execute the migration directly
$result = echo $migrationSQL | docker exec -i $ContainerName psql -U $Username -d $DatabaseName

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration completed successfully!" -ForegroundColor Green

    # Verify the column was added
    Write-Host "Verifying column exists..." -ForegroundColor Yellow
    $verifySQL = "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'agent_recordings' AND column_name = 'repetitions';"
    echo $verifySQL | docker exec -i $ContainerName psql -U $Username -d $DatabaseName
} else {
    Write-Host "❌ Migration failed!" -ForegroundColor Red
    exit 1
}