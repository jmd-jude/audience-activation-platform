import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.activation.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Activation deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting activation:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Activation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete activation', details: error.message },
      { status: 500 }
    );
  }
}
