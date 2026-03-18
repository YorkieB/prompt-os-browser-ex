import { useMemo } from 'react'
import { Prompt } from '@/lib/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserCircle } from '@phosphor-icons/react'

interface RoleFilterProps {
  prompts: Prompt[]
  selectedRole: string | null
  onRoleChange: (role: string | null) => void
}

export function RoleFilter({ prompts, selectedRole, onRoleChange }: RoleFilterProps) {
  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>()
    prompts.forEach((prompt) => {
      if (prompt.role && prompt.role.trim()) {
        roles.add(prompt.role)
      }
    })
    return Array.from(roles).sort()
  }, [prompts])

  const roleLabels = useMemo(() => {
    return uniqueRoles.map((role) => {
      const prefix = role.match(/^You are an? ([^.]+)/i)?.[1] || 
                     role.match(/^You are ([^.]+)/i)?.[1] ||
                     role.substring(0, 60)
      return {
        full: role,
        label: prefix.trim(),
      }
    })
  }, [uniqueRoles])

  if (uniqueRoles.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-3">
      <UserCircle className="w-5 h-5 text-muted-foreground" />
      <Select
        value={selectedRole || 'all'}
        onValueChange={(value) => onRoleChange(value === 'all' ? null : value)}
      >
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Filter by role" />
        </SelectTrigger>
        <SelectContent className="max-h-[400px]">
          <SelectItem value="all">All Roles ({prompts.length})</SelectItem>
          {roleLabels.map(({ full, label }) => (
            <SelectItem key={full} value={full} className="cursor-pointer">
              <span className="line-clamp-1" title={full}>
                {label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
